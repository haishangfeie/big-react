import { FiberRootNode } from './fiber';

/**
 * lane可以作为update的优先级
 */
export type Lane = number;
export type Lanes = number;

// !注意数值越小表示优先级越高(NoLane 0除外)
export const SyncLane = /*  */ 0b0001;
export const NoLane = /*    */ 0b0000;
export const NoLanes = /*   */ 0b0000;

export function mergeLanes(laneA: Lane, laneB: Lane): Lanes {
	return laneA | laneB;
}

export function requestUpdateLane() {
	return SyncLane;
}

export function getHighestPriorityLane(lanes: Lanes): Lane {
	// 值越小，对应的优先级越高（不包括0）
	return lanes & -lanes;
}

export function markRootFinished(root: FiberRootNode, lane: Lane) {
	root.pendingLanes &= ~lane;
}
