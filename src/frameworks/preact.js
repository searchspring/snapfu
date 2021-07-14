const preactComponent = (name) => `import { h, Fragment, Component } from 'preact';
import { observer } from 'mobx-react';

import { Recommendation } from '@searchspring/snap-preact-components';

@observer
export class ${name} extends Component {
	constructor(props) {
		super();

		const controller = props.controller;

		if (!controller.store.profile) {
			controller.init();
			controller.search();
		}
	}
	render() {
		const controller = this.props.controller;
		const store = controller?.store;

		return (
			<Recommendation controller={controller}/>
		);
	}
}`;

export const preact = {
	template: {
		dir: './src/components/Recommendations',
		component: preactComponent,
	},
};
