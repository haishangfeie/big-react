import ReactDOM from 'react-dom/client';
import { useState } from 'react';

const App = () => {
	const [num, setNum] = useState(100);
	const arr =
		num % 2 === 0
			? [<li key="1">1</li>, <li key="2">2</li>, <li key="3">3</li>]
			: [<li key="2">2</li>, <li key="1">1</li>, <li key="3">3</li>];
	return (
		<ul
			onClickCapture={() => {
				setNum((i) => ++i);
			}}
		>
			{arr}
		</ul>
	);
};

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
	<App />
);
