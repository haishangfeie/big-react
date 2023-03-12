import { Dispatch } from 'react/src/currentDispatcher';
import { Action } from 'shared/ReactTypes';
import { Lane, NoLane, isSubsetOfLanes } from './fiberLanes';

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
): {
	memoizedState: State;
	baseState: State;
	baseQueue: Update<State> | null;
} => {
	const result: ReturnType<typeof processUpdateQueue<State>> = {
		memoizedState: baseState,
		baseState,
		baseQueue: null
	};
	if (pendingUpdate !== null) {
		// pendingUpdate是环状链表的最后一个update，它的next就是第一个update
		const first = pendingUpdate.next;
		let pending = pendingUpdate.next;

		let newBaseState = baseState;
		let newBaseQueueFirst: Update<State> | null = null;
		let newBaseQueueLast: Update<State> | null = null;
		let newState = baseState;

		do {
			const updateLane = pending!.lane;
			if (!isSubsetOfLanes(renderLane, updateLane)) {
				// 优先级不够，被跳过
				const clone = createUpdate(pending!.action, pending!.lane);
				// 是不是第一个被跳过的
				if (newBaseQueueFirst === null) {
					newBaseQueueFirst = clone;
					newBaseQueueLast = clone;
					newBaseState = newState;
				} else {
					newBaseQueueLast!.next = clone;
					newBaseQueueLast = newBaseQueueLast!.next;
				}
			} else {
				// 优先级足够
				// 判断之前有没有跳过的update，
				if (newBaseQueueLast !== null) {
					const clone = createUpdate(pending!.action, NoLane);
					newBaseQueueLast!.next = clone;
					newBaseQueueLast = newBaseQueueLast!.next;
				}
				const action = pendingUpdate.action;
				if (action instanceof Function) {
					newState = action(baseState);
				} else {
					newState = action;
				}
			}
			pending = (pending as Update<any>).next as Update<any>;
		} while (pending !== first);

		if (newBaseQueueLast === null) {
			// 本次计算没有update被跳过
			newBaseState = newState;
		} else {
			newBaseQueueLast.next = newBaseQueueFirst;
		}

		result.memoizedState = newState;
		result.baseState = newBaseState;
		result.baseQueue = newBaseQueueLast;
	}
	return result;
};
