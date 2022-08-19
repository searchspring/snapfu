const defaultComponent = (name) => `import { h } from 'preact';
import { observer } from 'mobx-react';

import { Recommendation } from '@searchspring/snap-preact-components';

import './${name}.scss';

export const ${name} = observer((props) => {
	
	const controller = props.controller;
	const store = controller?.store;

	if (!controller.store.loaded && !controller.store.loading) {
		controller.search();
	}

	const parameters = store?.profile?.display?.templateParameters;

	return (
		store.results.length > 0 && (
			<Recommendation controller={controller}/>
		)
	);
	
});`;

const emailComponent = (name) => `import { h, Fragment } from 'preact';
import { observer } from 'mobx-react';
import classnames from 'classnames';

import { Result } from '@searchspring/snap-preact-components';

import './${name}.scss';

/**
 * COMPONENT MUST BE FULLY SELF-CONTAINED
 *
 * Intended to render results to generate images for email recommendations.
 * 
 * Details:
 *  - component should not render a grid (1 result per line)
 *  - cannot tie into external scripting
 *  - all styling and fonts must be bundled
 *  - lazy loading should be disabled
 *  - each result must have id={\`ss-emailrec\${index}\`}
 *  - results should not contain any interactive elements (ie. image pagination arrows, color swatches)
 * 
 * Test:
 *  - https://localhost:3333/email.html
 * 
 **/

export const ${name} = observer((props) => {
	const controller = props.controller;
	const store = controller?.store;

	return ( 
		store.results.length > 0 && (
			<Fragment>
				{store.results.map((result, idx) => (
					/* THIS OUTER "ss-emailrec" WRAPPER SHOULD NOT BE REMOVED, IT IS REQUIRED */
					<div key={idx} id={\`ss-emailrec\${idx}\`} style={{ display: 'block', width: '240px' }}>
						{/* BEGIN result component changes */}
						<Result
							result={result}
							hideBadge
							theme={{
								components: {
									image: {
										// lazy loading should be disabled
										lazy: false,	
									},
								},
							}} />
						{/* END result component changes */}
					</div>
				))}
			</Fragment>
		)
	);
});
`;

const defaultStyles = (name) => ``;

const emailStyles = (name) => `/*
	SASS for use in email component
	edit as needed
*/

a {
	text-decoration: none;
	color: inherit;
}

.ss__result {
	.ss__result__image-wrapper {
		.ss__image {
			img {

			}
		}
	}

	.ss__result__details {
		.ss__result__details__title {
			a {

			}
		}
		.ss__result__details__pricing {

		}
	}
}`;

export const preact = {
	template: {
		dir: './src/components/Recommendations',
		components: {
			default: defaultComponent,
			email: emailComponent,
		},
		styles: {
			default: defaultStyles,
			email: emailStyles,
		},
	},
};
