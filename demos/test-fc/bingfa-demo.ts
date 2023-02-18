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
const button = document.querySelector('button');
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
				count: 100,
				priority: priority as Priority
			});
			schedule();
		};
	});

function schedule() {
	const cbNode = getFirstCallbackNode();
	const curWork: Work = workList.sort((w1, w2) => {
		return w1.priority - w2.priority;
	})[0];

	const { priority: curPriority } = curWork;

	// 策略逻辑
	if (!curWork) {
		curCallback = null;
		cbNode && cancelCallback(cbNode);
		return;
	}
	if (curPriority === prevPriority) {
		return;
	}

	// 更高优先级
	if (cbNode) {
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
	while ((needSync || !shouldYield()) && work.count) {
		work.count--;
		inserSpan(work.priority);
	}

	// 中断执行||执行完
	prevPriority = work.priority;
	if (!work.count) {
		const workIndex = workList.indexOf(work);
		workList.splice(workIndex, 1);
		prevPriority = IdlePriority;
	}

	const prevCallback = curCallback;
	schedule();
	const newCallback = curCallback;

	if (newCallback && prevCallback === newCallback) {
		return perform.bind(null, work);
	}
}

function inserSpan(content) {
	const span = document.createElement('span');
	span.innerText = content;
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
