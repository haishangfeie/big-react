/**
 * lane可以作为update的优先级
 */
export type Lane = number;
export type Lanes = number;

export const SyncLane = /*  */ 0b0001;
export const NoLane = /*    */ 0b0000;
export const NoLanes = /*   */ 0b0000;

export function mergeLanes(laneA: Lane, laneB: Lane): Lanes {
	return laneA | laneB;
}

export function requestUpdateLanes() {
	return SyncLane;
}
