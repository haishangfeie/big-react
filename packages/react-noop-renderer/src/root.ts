import {
	createContainer,
	updateContainer
} from 'react-reconciler/src/fiberReconciler';
import { ReactElementType } from 'shared/ReactTypes';
import { Container, Instance } from './hostConfig';
import { REACT_ELEMENT_TYPE, REACT_FRAGMENT_TYPE } from 'shared/ReactSymbols';

let idCounter = 0;
export function createRoot() {
	const container = {
		rootID: idCounter++,
		children: []
	};

	// @ts-ignore
	const root = createContainer(container);

	function getChildren(parent: Container | Instance) {
		if (parent) {
			return parent.children;
		}
		return null;
	}

	function getChildrenAsJSX(root: Container) {
		const children = childToJSX(getChildren(root));
		if (Array.isArray(children)) {
			return {
				$$typeof: REACT_ELEMENT_TYPE,
				type: REACT_FRAGMENT_TYPE,
				props: { children },
				key: null,
				ref: null,
				__marks: 'feie'
			};
		}
		return children;
	}
	function childToJSX(child: any): any {
		if (typeof child === 'string' || typeof child === 'number') {
			return child;
		}
		if (Array.isArray(child)) {
			if (child.length === 0) {
				return null;
			}
			if (child.length === 1) {
				return childToJSX(child[0]);
			}

			const children: any[] = child.map(childToJSX);

			if (
				children.every(
					(child) => typeof child === 'number' || typeof child === 'string'
				)
			) {
				return children.join('');
			}
			return children;
		}

		// instance
		if (Array.isArray(child.children)) {
			const instance: Instance = child;
			const children: any = childToJSX(instance.children);
			const props = instance.props;

			if (children !== null && children !== undefined) {
				props.children = children;
			}
			return {
				$$typeof: REACT_ELEMENT_TYPE,
				type: instance.type,
				props,
				key: null,
				ref: null,
				__marks: 'feie'
			};
		}

		// textInstance
		return child.text;
	}
	return {
		render(element: ReactElementType) {
			return updateContainer(element, root);
		},
		getChildren: getChildren.bind(null, container),
		getChildrenAsJSX: getChildrenAsJSX.bind(null, container)
	};
}
