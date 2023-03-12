/* eslint-disable prettier/prettier */
import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';

function App() {
	const [num, setNum] = useState(100);
	return (
		<ul onClick={() => setNum(50)}>
			{new Array(num).fill(0).map((_, i) => {
				return <Child key={i}>{i}</Child>;
			})}
		</ul>
	);
}

function Child({ children }) {
	const now = performance.now();
	while (performance.now() - now < 4) {
		//
	}
	return <li>{children}</li>;
}

const root = ReactDOM.createRoot(document.querySelector('#root') as Element);

root.render(<App />);
