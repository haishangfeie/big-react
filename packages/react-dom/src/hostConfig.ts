import { FiberNode } from 'react-reconciler/src/fiber';
import { HostComponent, HostText } from 'react-reconciler/src/workTags';
import { DOMElement, updateFiberProps } from './SyntheticEvent';

export type Container = Element;
export type Instance = Element;
export type TextInstance = Text;

export const createInstance = (type: string, props: any): Instance => {
	// TODO: 处理props
	const element: DOMElement = document.createElement(type) as any;

	updateFiberProps(element, props);
	return element;
};

export const appendInitialChild = (
	parent: Instance | Container,
	child: Instance
) => {
	parent.appendChild(child);
};

export const createTextInstance = (content: string) => {
	return document.createTextNode(content);
};

export const appendChildToContainer = appendInitialChild;

export const commitUpdate = (fiber: FiberNode) => {
	switch (fiber.tag) {
		case HostText:
			const text = fiber.memoizedProps?.content;
			return commitTextUpdate(fiber.stateNode, text);
		case HostComponent:
			updateFiberProps();
			return;
		default:
			if (__DEV__) {
				console.warn('未实现的update类型', fiber);
			}
			break;
	}
};

export const commitTextUpdate = (
	textIntance: TextInstance,
	content: string
) => {
	textIntance.textContent = content;
	return textIntance;
};

export const removeChild = (
	child: Instance | TextInstance,
	container: Container
) => {
	container.removeChild(child);
};
