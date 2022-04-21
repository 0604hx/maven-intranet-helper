/**
 *
# webworker注意事项
    通过webworker,我们可以在前端做一些小规模分布式计算之类的工作，当然对过Web Worker有以下一些使用限制：
    1．Web Worker无法访问DOM节点；
    2．Web Worker无法访问全局变量或是全局函数；
    3．Web Worker无法调用alert()或者confirm之类的函数；
    4．Web Worker无法访问window、document之类的浏览器全局变量；
    不过Web Worker中的Javascript依然可以使用setTimeout(),setInterval()之类的函数，也可以使用XMLHttpRequest对象来做Ajax通信。也可以使用console.log()来打印日志
 */
    const { fillUp, increment, upload } = require("./maven")

/**
 *
 * @param {*} msg   当前文件对象处理结果
 * @param {*} count 文件序号（从 1 开始），如果为 true 则表示异步作业已结束
 * @returns
 */
 let logger = (msg, count)=> postMessage({msg, count})


self.onmessage = e=>{
    let { method, repoDir, outTxt, clean, targetDir } = e.data

    if(method == "fillUp")          fillUp(repoDir, outTxt, clean, logger)
    else if(method == "increment")  increment(repoDir, outTxt, targetDir, logger)
    else if(method == "upload")     upload(repoDir, e.data.host, e.data.auth, logger)
    else {
        console.error("无效的 method: ", method)
        close()
    }
}
