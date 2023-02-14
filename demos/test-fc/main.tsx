import { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';

const App = () => {
	const [num, setNum] = useState(1);
	useEffect(() => {
		console.log('APP mount');
	}, []);
	useEffect(() => {
		console.log('num change', num);
		return () => {
			console.log('num destroy');
		};
	}, [num]);
	return (
		<div onClick={() => setNum((i) => i + 1)}>
			{num % 2 === 1 ? <Child1 /> : <div>空空如也</div>}
		</div>
	);
};

function Child1() {
	useEffect(() => {
		console.log('Child1 create');
		return () => {
			console.log('Child1 destroy');
		};
	}, []);
	return (
		<div>
			Child1
			<Child2 />
		</div>
	);
}
function Child2() {
	useEffect(() => {
		console.log('Child2 create');
		return () => {
			console.log('Child2 destroy');
		};
	}, []);
	return <div>Child2</div>;
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
	<App />
);
