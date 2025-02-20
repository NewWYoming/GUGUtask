// 任务管理插件
const STORAGE_KEY = "任务列表库";
interface Task {
  id: string;
  groupid: string;
  name: string;
  deadline: string;
  progress: string; // 0-100
  reminder?: string;
  completed: string;
}
interface TaskStore {
  tasks: Task[];
}
// function getCtxAndMsgById(epId,groupId, userId, isPrivate) {
//   let eps = seal.getEndPoints();
//   for (let i = 0; i < eps.length; i++) {
//       if (eps[i].userId === epId) {
//           let msg = seal.newMessage();
//           if (isPrivate === true) {
//               msg.messageType = "private";
//           } else {
//               msg.messageType = "group";
//               msg.groupId = groupId;
//           }
//           msg.sender.userId = userId;
//           return {
//             ctx:seal.createTempCtx(eps[i], msg),
//             msg:msg};
//       }
//   }
//   return undefined;
// }

function getCtxAndMsgById(groupId, userId){
  let eps = seal.getEndPoints();
    let msg = seal.newMessage();
    msg.messageType = "group";
    msg.groupId = groupId;
    msg.sender.userId = userId;
    return {
      ctx:seal.createTempCtx(eps[0], msg),
      msg:msg};
}

function gettime(timestamps: number) {//将时间戳转换为北京时间
  let time = timestamps
	let beijingtime = new Date((time+28800)*1000);
  return beijingtime
}

function remind(ext) {
  const alltaskdata = JSON.parse(ext.storageGet(STORAGE_KEY));
  //遍历所有id
  let remindtext = {};
  for (let userid in alltaskdata) {
    let flag = 0;
    let taskStore: TaskStore = alltaskdata[userid];
    for (let task of taskStore.tasks) {
      //检查是否设置了提醒
      if (task.reminder == '1' && task.completed == '0') {
        let groupid = task.groupid;
        if (!remindtext[groupid]) {
          remindtext[groupid] = '';
        }
        remindtext[groupid] = remindtext[groupid] + `⏳ ${task.name} (进度: ${task.progress}%, 截止: ${task.deadline})\n`
        flag = 1;
      }
    }
    for (let groupid in remindtext) {
      if (flag === 1) {
        //对“QQ:15556"删去'QQ:'
        let useridnumber = userid.replace(/[^0-9]/ig,"");
        remindtext[groupid] = remindtext[groupid] + `[CQ:at,qq=${useridnumber}]\n`
      }
    }
  }
  for (let groupid in remindtext) {
    let ctxnMsg = getCtxAndMsgById(groupid, '0');
    seal.replyGroup(ctxnMsg.ctx,ctxnMsg.msg,remindtext[groupid]);
  }
}

function remindingroup(ext,selfgroupid) {
  const alltaskdata = JSON.parse(ext.storageGet(STORAGE_KEY));
  //遍历所有id
  let remindtext = {};
  for (let userid in alltaskdata) {
    let flag = 0;
    let taskStore: TaskStore = alltaskdata[userid];
    for (let task of taskStore.tasks) {
      //检查是否设置了提醒
      if (task.reminder == '1' && task.completed == '0') {
        let groupid = task.groupid;
        if (!remindtext[groupid]) {
          remindtext[groupid] = '';
        }
        remindtext[groupid] = remindtext[groupid] + `⏳ ${task.name} (进度: ${task.progress}%, 截止: ${task.deadline})\n`
        flag = 1;
      }
    }
    for (let groupid in remindtext) {
      if (flag === 1) {
        //对“QQ:15556"删去'QQ:'
        let useridnumber = userid.replace(/[^0-9]/ig,"");
        remindtext[groupid] = remindtext[groupid] + `[CQ:at,qq=${useridnumber}]\n`
      }
    }
  }
  let ctxNMsg = getCtxAndMsgById(selfgroupid, '0');
  seal.replyGroup(ctxNMsg.ctx,ctxNMsg.msg,remindtext[selfgroupid]+'');
}

function deletepast(ext, todaydate:Date) {
  // 获取所有任务数据
  const alltaskdata = JSON.parse(ext.storageGet(STORAGE_KEY));

  // 遍历每个用户
  for (let userid in alltaskdata) {
    const taskStore = alltaskdata[userid];

    // 过滤掉过期的任务
    taskStore.tasks = taskStore.tasks.filter(task => {
      const taskDeadline = new Date(task.deadline);
      const today = todaydate;

      // 如果任务截止日期在今天之后或等于今天，保留
      return taskDeadline >= today;
    });

    // 更新用户的任务列表
    alltaskdata[userid] = taskStore;
  }

  // 将更新后的数据保存回存储
  ext.storageSet(STORAGE_KEY, JSON.stringify(alltaskdata));
}

function main() {
  // 注册扩展
  let ext = seal.ext.find('GUGUtask');
  if (!ext) {
    ext = seal.ext.new('GUGUtask', 'NewWYoming', '1.1.1');
    seal.ext.register(ext);
  }
  // 编写任务指令
  const cmdTask = seal.ext.newCmdItemInfo();
  cmdTask.name = '任务';
  cmdTask.help = '咕咕任务管理命令，可用以下参数：\n' +
    '.任务 add <任务名> <截止天数/截止日期> [是/QQ号/公开] [是] - 添加任务\n' +
    '  - 截止日期可以是天数或YYYY-MM-DD格式\n' +
    '  - "是"表示设置提醒\n' +
    '  - 可选QQ号来为其他用户添加任务\n' +
    '  - "公开"表示添加到公开任务列表\n' +
    '.任务 list [QQ号] - 查看任务列表，包括个人任务和公开任务\n' +
    '.任务 delete <任务id/过期> [QQ号/公开] - 删除任务\n' +
    '  - 使用"过期"删除所有过期任务\n' +
    '  - 可指定QQ号或"公开"来删除指定对象的任务\n' +
    '.任务 update <任务id> <进度> [QQ号/公开] - 更新任务进度(0-100)\n' +
    '.任务 remind - 发送当前群组的任务提醒\n' +
    '.任务 help - 显示本帮助';
  cmdTask.solve = (ctx, msg, cmdArgs) => {
    // 检查触发用户，请求数据库
    const userid = msg.sender.userId;
    const groupid = msg.groupId;
    let taskStoredata = {};
    if (!ext.storageGet(STORAGE_KEY)) {
      taskStoredata = {
        [userid]: { tasks: [] }
      };
    } else {
      // 读取任务列表
      taskStoredata = JSON.parse(ext.storageGet(STORAGE_KEY));
    }
    let taskStore: TaskStore = taskStoredata[userid] || { tasks: [] };//获取用户的任务列表
    let taskStorepublic: TaskStore = taskStoredata['public'] || { tasks: [] };//获取公开任务列表
    const subCmd = cmdArgs.getArgN(1);
    switch (subCmd) {
      case 'add': {
        const name = cmdArgs.getArgN(2);
        //分支：若参数3输入为数字，则表示截止天数，若为日期格式YYYY-MM-DD，则表示截止日期
        const deadline = cmdArgs.getArgN(3);
        const arg4 = cmdArgs.getArgN(4);
        let deadlineDate = gettime(msg.time);
        //设定小时和分钟和秒为晚上12点整
        deadlineDate.setHours(0);
        deadlineDate.setMinutes(0);
        deadlineDate.setSeconds(0);
        deadlineDate.setMilliseconds(0);
        //检查参数3是否为数字
        if (!isNaN(Number(deadline))) {
          if (Number(deadline) < 0 || Number(deadline) > 365 || !Number.isInteger(Number(deadline))) {
            seal.replyToSender(ctx, msg, '请检查输入的截止天数是否过大或不是正整数');
            return seal.ext.newCmdExecuteResult(false);
          }else {
            deadlineDate.setDate(deadlineDate.getDate() + Number(deadline));
          }
        }else if (deadline.match(/^\d{4}-\d{2}-\d{2}$/)) {
          deadlineDate = new Date(deadline);
        }else{
          seal.replyToSender(ctx, msg, '请检查输入的截止日期格式是否正确');
          return seal.ext.newCmdExecuteResult(false);
        }
        if (!name || !deadline) {
          seal.replyToSender(ctx, msg, '请检查是否输入了任务名称和截止日期');
          return seal.ext.newCmdExecuteResult(false);
        }
        let strdeadline = ''; //将截止日期转换为字符串YYYY-MM-DD
        strdeadline += `${deadlineDate.getFullYear()}-`;
        if (deadlineDate.getMonth() < 9) {
          strdeadline += `0${deadlineDate.getMonth()+1}-`;
        } else {
          strdeadline += `${deadlineDate.getMonth()+1}-`;
        }
        if (deadlineDate.getDate() < 10) {
          strdeadline += `0${deadlineDate.getDate()}`;
        } else {
          strdeadline += `${deadlineDate.getDate()}`;
        }
        let newtask: Task = {
          id: `${msg.time}`,
          groupid: groupid,
          name: name,
          deadline: strdeadline,
          progress: "0",
          completed: "0"
        };
        let targetid = userid;
        let targetStore = taskStore;
        let replytextadd = `任务： "${name}" 已添加，截止时间 ${strdeadline}`;
        if (arg4 == '是') {//判断是否存在参数4并且判断参数4是否是是
          newtask.reminder = "1";
          replytextadd = `任务： "${name}" 已添加，截止时间 ${strdeadline}，已设置提醒`;
        } else if(arg4 && /^\d+$/.test(arg4)){//判断参数4是否是qq号
          const arg5 = cmdArgs.getArgN(5);
          targetid = `QQ:` + arg4;
          if (arg5 == '是') {
            newtask.reminder = "1";
            replytextadd = `对象为${arg4}的任务： "${name}" 已添加，截止时间 ${strdeadline}，已设置提醒`;
          }
          else {
            replytextadd = `对象为${arg4}的任务： "${name}" 已添加，截止时间 ${strdeadline}`;
          }
        } else if(arg4 && arg4 == '公开'){
          targetid = 'public';
          targetStore = taskStorepublic;
          if (cmdArgs.getArgN(5) == '是') {
            newtask.reminder = "1";
            replytextadd = `公开任务： "${name}" 已添加，截止时间 ${strdeadline}，已设置提醒`;
          }else {
            replytextadd = `公开任务： "${name}" 已添加，截止时间 ${strdeadline}`;
          }
        } else {}
        //回填数据库
        targetStore.tasks.push(newtask);
        taskStoredata[targetid] = targetStore;
        ext.storageSet(STORAGE_KEY, JSON.stringify(taskStoredata));
        seal.replyToSender(ctx, msg, replytextadd);
        return seal.ext.newCmdExecuteResult(true);
      }
      case 'list': {
        if (!cmdArgs.getArgN(2)) {
          let yourlisttext = '🈚';
          let publiclisttext = '🈚';
          if (taskStore.tasks.length !== 0){
            const taskList = taskStore.tasks.map(t =>
              `[${t.completed === '1' ? '✅' : '⏳'}] 编号：${t.id}任务：${t.name} (进度: ${t.progress}%, 截止: ${t.deadline})`
            ).join('\n');
            yourlisttext = `${taskList}`;
          }
          //筛选groupid是本群id的公共任务
          let thisgrouptaskstore: TaskStore = { tasks: [] };
          for (let task of taskStorepublic.tasks) {
            if (task.groupid == groupid) {
              thisgrouptaskstore.tasks.push(task);
            }
          }
          if (thisgrouptaskstore.tasks.length !== 0){
            const publictasklist = thisgrouptaskstore.tasks.map(t =>
              `[${t.completed === '1' ? '✅' : '⏳'}] 编号：${t.id}任务：${t.name} (进度: ${t.progress}%, 截止: ${t.deadline})`
            ).join('\n');
            publiclisttext = `${publictasklist}`;
          }
          seal.replyToSender(ctx, msg, `你的任务列表：\n${yourlisttext}\n公开任务列表：\n${publiclisttext}`);
          return seal.ext.newCmdExecuteResult(true);
        }else {
          let targetuserid =  `QQ:` + cmdArgs.getArgN(2);
          let targettaskStore: TaskStore = taskStoredata[targetuserid] || { tasks: [] };
          let yourlisttext = '🈚';
          let publiclisttext = '🈚';
          if (targettaskStore.tasks.length !== 0){
            const taskList = taskStore.tasks.map(t =>
              `[${t.completed === '1' ? '✅' : '⏳'}] ${t.name} (进度: ${t.progress}%, 截止: ${t.deadline})`
            ).join('\n');
            yourlisttext = `${taskList}`;
          }
          //筛选groupid是本群id的公共任务
          let thisgrouptaskstore: TaskStore = { tasks: [] };
          for (let task of taskStorepublic.tasks) {
            if (task.groupid == groupid) {
              thisgrouptaskstore.tasks.push(task);
            }
          }
          if (thisgrouptaskstore.tasks.length !== 0){
            const publictasklist = thisgrouptaskstore.tasks.map(t =>
              `[${t.completed === '1' ? '✅' : '⏳'}] ${t.name} (进度: ${t.progress}%, 截止: ${t.deadline})`
            ).join('\n');
            publiclisttext = `${publictasklist}`;
          }
          seal.replyToSender(ctx, msg, `你的任务列表：\n${yourlisttext}\n公开任务列表：\n${publiclisttext}`);
          return seal.ext.newCmdExecuteResult(true);
        }
      }
      case 'delete': {
        const taskid = cmdArgs.getArgN(2);
        let targetid = userid;
        let tasktargetStore = taskStore;
        if (!taskid) {
          return seal.ext.newCmdExecuteResult(false);
        }
        const userflag = cmdArgs.getArgN(3);
        if (userflag && /^\d+$/.test(userflag)) {
          targetid = `QQ:` + userflag;
          tasktargetStore = taskStoredata[targetid] || { tasks: [] };
        } else if (userflag && userflag == '公开') {
          targetid = 'public';
          tasktargetStore = taskStorepublic;
        } else {}
        if (taskid === '过期') {
          deletepast(ext, gettime(msg.time));
          seal.replyToSender(ctx, msg, `已删除所有过期任务`);
          return seal.ext.newCmdExecuteResult(true);
        }
        const index = tasktargetStore.tasks.findIndex(t => t.id === taskid);
        if (index === -1) {
          seal.replyToSender(ctx, msg, `未找到id为${taskid}的任务。`);
          return seal.ext.newCmdExecuteResult(false);
        }
        tasktargetStore.tasks.splice(index, 1);
        taskStoredata[targetid] = tasktargetStore;
        ext.storageSet(STORAGE_KEY, JSON.stringify(taskStoredata));
        seal.replyToSender(ctx, msg, `id为${taskid}的任务已删除。`);
        return seal.ext.newCmdExecuteResult(true);
      }
      case 'update': {
        const taskid = cmdArgs.getArgN(2);
        const progress = Number(cmdArgs.getArgN(3));
        const userflag = cmdArgs.getArgN(4);
        let targetid = userid;
        let tasktargetStore = taskStore;
        if (userflag && /^\d+$/.test(userflag)) {
          targetid = `QQ:` + userflag;
          tasktargetStore = taskStoredata[targetid] || { tasks: [] };
        } else if (userflag && userflag == '公开') {
          targetid = 'public';
          tasktargetStore = taskStorepublic;
        } else {}
        if (!taskid || isNaN(progress) || progress < 0 || progress > 100) {
          return seal.ext.newCmdExecuteResult(false);
        }
        const index = tasktargetStore.tasks.findIndex(t => t.id === taskid);
        if (index === -1) {
          seal.replyToSender(ctx, msg, `未找到id为${taskid}的任务。`);
          return seal.ext.newCmdExecuteResult(false);
        }
        tasktargetStore.tasks[index].progress = `${progress}`;
        if (progress === 100) {
          tasktargetStore.tasks[index].completed = '1';
        }
        taskStoredata[targetid] = tasktargetStore;
        ext.storageSet(STORAGE_KEY, JSON.stringify(taskStoredata));
        seal.replyToSender(ctx, msg, `id为${taskid}的任务进度已更新为 ${progress}%`);
        return seal.ext.newCmdExecuteResult(true);
      }
      case 'remind': {
        remindingroup(ext,msg.groupId);
        //remind(ext);
        seal.replyToSender(ctx, msg, `已发送提醒`);
        return seal.ext.newCmdExecuteResult(true);
      }
      case 'help': {
        const ret = seal.ext.newCmdExecuteResult(true);
        ret.showHelp = true;
        return ret;
      }
      default: {
        seal.replyToSender(ctx, msg, `咕咕任务管理插件，可使用add/list/delete/update/remind/help命令`);
        return seal.ext.newCmdExecuteResult(false);
      }
    }
  }
  // 注册命令
  ext.cmdMap['任务'] = cmdTask;
  //注册定时任务
  seal.ext.registerTask(ext, "cron", '0 12 * * *', (taskCtx) =>  remind(ext), "reminder", "任务系统的每日提醒");
  seal.ext.registerTask(ext, "cron", '0 16 * * *', (taskCtx) =>  deletepast(ext, gettime(taskCtx.now)), "renewpast", "任务系统的每晚自清理");
}

main();
