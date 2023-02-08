import { useState } from 'react';
import ReactDOM from 'react-dom/client';

const App = () => {
	const [num, setNum] = useState(1);
	const arr = num % 2 ? [<li>3</li>, <li>4</li>] : [<li>4</li>, <li>3</li>];
	console.log(num);
	return (
		<ul onClick={() => setNum((i) => i + 1)}>
			<li>1</li>
			<li>2</li>
			{arr}
		</ul>
	);
};

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
	<App />
);
