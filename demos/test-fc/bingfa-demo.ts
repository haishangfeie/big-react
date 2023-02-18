import './style.css';
const button = document.querySelector('button');
const root = document.querySelector('#root');
interface Work {
	// 工作要执行的次数，类比react组件的数量
	count: number;
}
const workList: Work[] = [];
button &&
	(button.onclick = (e) => {
		workList.unshift({
			count: 100
		});
		schedule();
	});

function schedule() {
	const curWork = workList.pop();

	if (curWork) {
		perform(curWork);
	}
}

function perform(work: Work) {
	while (work.count) {
		work.count--;
		inserSpan('0');
	}
	schedule();
}

function inserSpan(content) {
	const span = document.createElement('span');
	span.innerText = content;

	root!.appendChild(span);
}
