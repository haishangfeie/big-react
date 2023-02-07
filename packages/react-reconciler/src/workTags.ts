export type WorkTag =
	| typeof FunctionComponent
	| typeof HostRoot
	| typeof HostComponent
	| typeof HostText;

export const FunctionComponent = 0;
/**
 * 宿主树的根，一个react应用只有一个该类型的fiberNode节点。
 * 不过，一个页面可以创建多个应用
 */
// 例如：ReactDom.createRoot().render()；ReactDom.createRoot().render()；ReactDom.createRoot().render()
export const HostRoot = 3;
/** fiberNode.tag如果是HostComponent，那么fiberNode.stateNode对应的就是dom：<div></div> */
export const HostComponent = 5;
export const HostText = 6;
