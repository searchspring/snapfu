const preactComponent = (name) => `import { h, Fragment, Component } from 'preact';
import { observer } from 'mobx-react';

import { Recommendation } from '@searchspring/snap-preact-components';

@observer
export class ${name} extends Component {
	constructor(props) {
		super();

		const controller = props.controller;

		if (!controller.store.profile) {
			controller.search();
		}
	}
	render() {
		const controller = this.props.controller;
		const parameters = controller.store?.profile?.display?.templateParameters;

		return (
			<Recommendation controller={controller}/>
		);
	}
}`;

const emailComponent = (name) => `import { h, Fragment, Component } from 'preact';
import { observer } from 'mobx-react';

import { Result } from '@searchspring/snap-preact-components';

@observer
export class ${name} extends Component {
	render() {
		const controller = this.props.controller;
		const store = controller?.store;
		const theme = {
			components: {
				image: {
					lazy: false,
				},
			},
		};
		return (
			<div>
				{store.results.map((result, idx) => (
					//****** IMPORTANT  *******//
					// THIS OUTER "ss-emailrec" WRAPPER IS REQUIRED FOR EMAIL RECS TO WORK PROPERLY.
					// DO NOT REMOVE OR EDIT IT
					<div key={idx} id={\`ss-emailrec\${idx}\`} style={{ display: 'block', width: '240px' }}>
						{/* make your result changes here  */}
						<Result result={result} theme={theme}></Result>
					</div>
				))}
			</div>
		);
	}
}
`;

export const preact = {
	template: {
		dir: './src/components/Recommendations',
		components: {
			default: preactComponent,
			email: emailComponent,
		},
	},
};
