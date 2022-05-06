const { createWriteStream, readdir, readFileSync, statSync, truncate, existsSync, mkdirSync, copyFile, readFile } = require('fs')
const { resolve, dirname } = require("path")
const { request } = require("http")

const excludes = [
    /\.repositories$/, /\.lastUpdated$/, /.DS_Store$/, /mavenimport.sh/, /maven-metadata-deployment.*\.xml/,
    /maven-metadata-local.*\.xml/, /archetype-catalog.xml/
]

let folderCount = 0
let DURATION = 1000

let walk = (dir, onFile)=>{
    folderCount ++
    readdir(dir, (err, files)=>{
        if(err) throw err

        files.forEach(f=>{
            let file = resolve(dir, f)
            if(statSync(file).isFile()){
                if(excludes.some(v=>v.test(f))) return
                onFile(file)
            }
            else{
                walk(file, onFile)
            }
        })
        folderCount --
    })
}

let walkDirWithPromise = (dir, onFile)=>new Promise(onEnd=>{
    folderCount = 0
    let timer = setInterval(()=>{
        if(folderCount <= 0){
            setTimeout(onEnd, DURATION)
            clearInterval(timer)
        }
    }, DURATION)

    walk(dir, onFile)
})

module.exports = {
    /**
     *
     * @param {*} dir
     * @param {*} outTxt
     * @param {*} cleanOnStart
     * @param {*} logger
     */
    fillUp (dir, outTxt, cleanOnStart=false, logger=()=>{}){
        if(cleanOnStart && existsSync(outTxt)){
            truncate(outTxt, 0, err=> {
                if(err) throw err
                logger(`清空 ${outTxt}`)
            })
        }

        let os = createWriteStream(outTxt, {flags:'a'})
        let count = 0
        let started = Date.now()

        walkDirWithPromise(
            dir,
            f=>{
                f = f.substr(dir.length + 1)
                os.write(`${f}\n`)

                logger(f, ++count)
            }
        ).then(()=> {
            os.close()
            logger(`处理完成（共 ${count} 个文件，用时 ${(Date.now() - started)/1000}秒），结果保存到 ${outTxt}`, true)
        })
    },

    /**
     * 增量复制
     * @param {*} dir       待比对的仓库地址
     * @param {*} outTxt    maven.txt 文件
     * @param {*} targetDir 增量包拷贝目录
     * @param {*} logger
     */
    increment (dir, outTxt, targetDir, logger=()=>{}){
        let files = readFileSync(outTxt, {encoding: "utf-8"}).split("\n")

        let count = 0
        walkDirWithPromise(
            dir,
            f=>{
                let ff = f.substr(dir.length + 1)
                if(!files.includes(ff)){
                    let target = resolve(targetDir, ff)
                    existsSync(dirname(target)) || mkdirSync(dirname(target), {recursive: true})

                    copyFile(f, target, e=> logger(e? `操作失败 ${ff}:${e.message}`:`新加文件 ${ff}`, ++count))
                }
            }
        ).then(()=> logger(`处理完成，共拷贝${count}个文件到目录 ${resolve(targetDir)}`, true))
    },

    /**
     * 将 dir 下的文件提交到内网私服
     * 本方法使用同步方式提交文件（异步时可能出现服务器处理不过来的问题 🤣）
     * 
     * NEXUS 支持重复上传
     * 
     * @param {*} dir
     * @param {*} host      仓库地址，示例 http://ip:port/repository/my_repo/
     * @param {*} auth      授权信息，格式为 username:password
     * @param {*} logger
     * @returns             返回上传出错的文件信息
     */
     async upload (dir, host, auth, logger=()=>{}){
        let count = 0
        let done  = 0
        let files = []
        let failList = []

        let walkDir = (_dir)=>{
            let _files = readdirSync(_dir)
            _files.forEach(f=>{
                let file = resolve(_dir, f)
                if(statSync(file).isFile()){
                    if(excludes.some(v=>v.test(f))) return
                    files.push(file)
                }
                else
                    walkDir(file)
            })
        }
        walkDir(dir)
        logger(`读取目录完成，共检测到${files.length}个文件...`, "SCAN")

        for (let i = 0; i < files.length; i++) {
            const f = files[i]
            let fileData = readFileSync(f, {flag:'r'})
            await new Promise((ok, fail)=>{
                let started = Date.now()
                let fName = f.substring(dir.length+1)
                let url = `${host}/${fName}`
                let req = request(
                    url,
                    { method:"PUT", auth },
                    res=>{
                        let { statusCode, statusMessage } = res

                        if(statusCode == 201){
                            let used = Date.now() - started
                            logger(`用时 ${(used/1000).toFixed(3)}秒 | ${statusCode} | ${fName}`, ++count)
                            done ++
                        }
                        else{
                            logger(`上传出错 | ${statusCode} ${statusMessage} | ${fName}`, ++count)
                            failList.push({file: f, code: statusCode, msg: statusMessage, url})
                        }

                        ok(statusCode == 201)
                    }
                )
                req.on('error', e=>{
                    logger(`网络请求出错: ${e} | ${fName}`, ++count)
                    failList.push({file: f, code: -1, msg: e.message, url})
                    fail(e)
                })
                req.setTimeout(120*1000)
                req.write(fileData)
                req.end()
            })
        }

        logger(`处理完成，共上传${count}个文件，成功 ${done} 个，失败 ${count-done} 个`, true)
        console.group("\n错误信息如下：")
        failList.forEach(d=>{
            console.groupCollapsed(d.file)
            console.error(`提交地址：${d.url}`)
            console.error(`错误代码：${d.code}`)
            console.error(`错误信息：${d.msg}`)
            console.groupEnd()
        })
        console.groupEnd()

        return failList
    }
}
