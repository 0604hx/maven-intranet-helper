const { fillUp, increment, upload } = require("./maven")

const repoDir   = process.argv[2] || __dirname
const mode      = process.argv[3] || "0"        // 0=统计、1=增量拷贝、2=上传到nexus
const outTxt    = "maven.txt"

if(repoDir == "--help" || repoDir == '-H'){
    console.log(`
******************************************************************************************
欢迎使用 MAVEN私服辅助工具（VERSION=0.0.1）
******************************************************************************************
使用方式：node index.js {仓库目录} {mode} [{url} {auth}]

    模式/mode
        0   入库统计：将 {仓库目录} 中的文件信息汇总到 maven.txt
        1   增量拷贝：将 {仓库目录} 中的文件与 maven.txt 比对，拷贝新增 JAR/POM 到 repository 目录
        2   上传私服：将 {仓库目录} 下的文件提交到内网私服，此时参数 {mode} 后需要附带两个参数
            {url}   私服地址，如 http://ip:port/repository/my_repo/
            {auth}  账号密码，如 admin:admin
******************************************************************************************
    `)
    process.exit(0)
}

/**
 * Pad `str` left to `len` with optional `c` char.
 *
 * @param {String} str
 * @param {Number} len
 * @param {String} c
 * @return {String}
 * @api public
 */
 function left(str, len, c){
    c = c || ' ';
    str = str + "";
    if (str.length >= len) return str;
    return Array(len - str.length + 1).join(c) + str;
}

/**
 *
 * @param {*} msg   当前文件对象处理结果
 * @param {*} count 文件序号（从 1 开始），如果为 true 则表示异步作业已结束
 * @returns
 */
let logger = (msg, count)=> console.info(`${count===true?"[-FINISH-]":(`[${left(count, 8)}]`)} ${msg}`)

if(mode == "0")         fillUp(repoDir, outTxt, false, logger)
else if(mode == "1")    increment(repoDir, outTxt, "repository", logger)
else if(mode == "2")    upload(repoDir, process.argv[4], process.argv[5], logger)
else                    console.error(`无效模式 ${mode} （请使用 node index.js --help 或者 node index.js -H 查看使用说明）`)
