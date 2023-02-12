import { Dispatch } from 'react/src/currentDispatcher';
import { Action } from 'shared/ReactTypes';
import { Lane } from './fiberLanes';

export interface Update<State> {
	action: Action<State>;
	next: Update<any> | null;
	lane: Lane;
}

export interface UpdateQueue<State> {
	shared: {
		pending: Update<State> | null;
	};
	dispatch: Dispatch<State> | null;
}

export const createUpdate = <State>(
	action: Action<State>,
	lane: Lane
): Update<State> => {
	return {
		action,
		next: null,
		// 这里的lane标识更新优先级
		lane
	};
};

export const createUpdateQueue = <State>() => {
	// 这里设计为这个结构的原因是为了让current和workInProgress可以复用一个对象
	return {
		shared: {
			pending: null
		},
		dispatch: null
	} as UpdateQueue<State>;
};

export const enqueueUpdate = <State>(
	updateQueue: UpdateQueue<State>,
	update: Update<State>
) => {
	const pending = updateQueue.shared.pending;
	if (pending === null) {
		// 自己指向自己，构成环状链表:peind=a->a
		update.next = update;
	} else {
		// 假如update是b,结果会是pending=b->a->b
		// c,  c->a, b->c  // c->a->b->c
		update.next = pending.next;
		pending.next = update;
	}
	// 所以pending指向的是最后一个update，后面是顺序依次从第一个指向到最后一个，形成环状
	// 即：d->a->b->c->d
	updateQueue.shared.pending = update;
};

export const processUpdateQueue = <State>(
	baseState: State,
	pendingUpdate: Update<State> | null,
	renderLane: Lane
): { memoizedState: State } => {
	const result: ReturnType<typeof processUpdateQueue<State>> = {
		memoizedState: baseState
	};
	if (pendingUpdate !== null) {
		// pendingUpdate是环状链表的最后一个update，它的next就是第一个update
		const first = pendingUpdate.next;
		let pending = pendingUpdate.next;
		do {
			const updateLane = pending!.lane;
			if (updateLane === renderLane) {
				const action = pendingUpdate.action;
				if (action instanceof Function) {
					baseState = action(baseState);
				} else {
					baseState = action;
				}
			} else {
				if (__DEV__) {
					// ? 我的理解是当前只有同步优先级，所以不可能进到这里，但是如果存在多种优先级时，应该是有可能走进这个逻辑的，而且处理也应该不是报错
					console.error(
						'不应该进入processUpdateQueue updateLane !== renderLane 这个逻辑',
						updateLane,
						renderLane
					);
				}
			}
			pending = (pending as Update<any>).next as Update<any>;
		} while (pending !== first);
	}
	result.memoizedState = baseState;
	return result;
};
