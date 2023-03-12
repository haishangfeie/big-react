import './style.css';

import {
	/** 同步更新的优先级 */
	unstable_ImmediatePriority as ImmediatePriority,
	/** 例如点击事件的优先级 */
	unstable_UserBlockingPriority as UserBlockingPriority,
	/** 正常优先级 */
	unstable_NormalPriority as NormalPriority,
	/** 低优先级 */
	unstable_LowPriority as LowPriority,
	/** 空闲时优先级 */
	unstable_IdlePriority as IdlePriority,
	unstable_scheduleCallback as scheduleCallback,
	unstable_shouldYield as shouldYield,
	CallbackNode,
	unstable_getFirstCallbackNode as getFirstCallbackNode,
	unstable_cancelCallback as cancelCallback
} from 'scheduler';

/*
scheduleCallback 有两个特性：
1. scheduleCallback 的callback参数如果返回的是函数，那么会直接执行返回的函数
2. scheduleCallback 返回一个CallbackNode 类型的函数，每次调用scheduleCallback 都会返回一个新的CallbackNode 


调用schedule，如果是中断的情况，且优先级相同的情况，就不会往下执行调度，所以CallbackNode不会更新，所以CallbackNode不会更新时就需要通过返回函数的方式来执行perform
 */

const root = document.querySelector('#root');
interface Work {
	// 工作要执行的次数，类比react组件的数量
	count: number;
	priority: Priority;
}

type Priority =
	| typeof ImmediatePriority
	| typeof UserBlockingPriority
	| typeof NormalPriority
	| typeof LowPriority
	| typeof IdlePriority;

const workList: Work[] = [];

let prevPriority: Priority = IdlePriority;
let curCallback: CallbackNode | null = null;

[ImmediatePriority, UserBlockingPriority, NormalPriority, LowPriority]
	.reverse()
	.forEach((priority) => {
		const btn = document.createElement('button');
		root?.appendChild(btn);

		btn.innerText =
			[
				'',
				'ImmediatePriority',
				'UserBlockingPriority',
				'NormalPriority',
				'LowPriority'
			][priority] +
			'_' +
			priority;
		btn.onclick = () => {
			workList.unshift({
				count: 1000,
				priority: priority as Priority
			});
			schedule();
		};
	});

const button = document.querySelector('#button');
button.onclick = () => {
	workList.unshift({
		count: 1000,
		priority: LowPriority
	});
	schedule();
	const channel = new MessageChannel();
	const port = channel.port2;
	channel.port1.onmessage = () => {
		workList.unshift({
			count: 1000,
			priority: UserBlockingPriority
		});
		schedule();
	};

	port.postMessage(null);
};
function schedule() {
	const cbNode = getFirstCallbackNode();
	const curWork: Work = workList.sort((w1, w2) => {
		return w1.priority - w2.priority;
	})[0];

	// 策略逻辑
	if (!curWork) {
		curCallback = null;
		cbNode && cancelCallback(cbNode);
		console.log('curWork不存在，取消');
		return;
	}
	const curPriority = curWork.priority;
	if (curPriority === prevPriority) {
		return;
	}

	// 更高优先级
	if (cbNode) {
		console.log('存在更高优先级任务', curPriority, prevPriority);
		cancelCallback(cbNode);
	}

	curCallback = scheduleCallback(curPriority, perform.bind(null, curWork));
}

function perform(work: Work, didTimeout?: boolean) {
	/* 
    支持并发模式需要考虑：
    1.  work.priority
    2.  饥饿问题（即由于优先级过低导致一直无法执行）
    3.  时间切片
  */
	const needSync = work.priority === ImmediatePriority || didTimeout;
	console.log(
		`执行perform，work.priority:${work.priority},work.count:${work.count}`
	);
	while ((needSync || !shouldYield()) && work.count) {
		work.count--;
		inserSpan(work.priority, `(${work.count + 1})`);
	}

	// 中断执行||执行完
	prevPriority = work.priority;
	if (!work.count) {
		// 执行完
		const workIndex = workList.indexOf(work);
		console.log(
			`删除work,priority:${work.priority},count:${work.count},workIndex:${workIndex},workList.length:${workList.length}`
		);
		if (workIndex !== -1) {
			workList.splice(workIndex, 1);
		}
		prevPriority = IdlePriority;
	}

	const prevCallback = curCallback;
	schedule();
	const newCallback = curCallback;

	if (newCallback && prevCallback === newCallback) {
		console.log(
			`直接调用perform,priority:${work.priority},count:${work.count}`
		);
		return perform.bind(null, work);
	}
}

function inserSpan(content, content2) {
	const span = document.createElement('span');
	span.innerText = content + content2;
	span.className = `priority-${content}`;
	// 用到耗时间的
	doSomeBuzyWork(5000000);
	root!.appendChild(span);
}

function doSomeBuzyWork(len: number) {
	let res = 0;
	while (len--) {
		res += len;
	}
}
