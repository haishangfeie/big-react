import ReactDOM from 'react-noop-renderer/index';

function App() {
	return (
		<>
			<Child />
			<div>hello world</div>
		</>
	);
}

function Child() {
	return 'Child';
}

const root = ReactDOM.createRoot();
root.render(<App />);
window.root = root;
