import { walk } from 'estree-walker';
import MagicString from 'magic-string';
import { type AST, parse } from 'svelte/compiler';

/** Strips the types from the provided Svelte source.
 *
 * @param source TypeScript source which will have it's types stripped
 * @returns
 *
 * ## Usage
 * ```ts
 * import assert from 'node:assert';
 * import { strip } from 'sv-strip';
 *
 * const source = `<script lang="ts">
 *      let value = $state<string>('');
 * </script>
 *
 * <input bind:value/>`
 *
 * const stripped = strip(source);
 *
 * const expected = `<script>
 *       let value = $state('');
 * </script>
 *
 * <input bind:value/>`;
 *
 * assert(stripped === expected);
 * ```
 */
export function strip(source: string): string {
	const ast = parse(source);

	const src = new MagicString(source);

	const enter = (node: AST.BaseNode) => {
		// remove lang="ts" if it exists in the script
		if (node.type === 'Script') {
			// @ts-expect-error I promise you it does exist
			const scriptDeclaration = src.toString().slice(node.start, node.content.start);

			const langIndex = scriptDeclaration.search(/ lang=["|']ts["|']/g);

			if (langIndex !== -1) {
				src.update(node.start + langIndex, node.start + langIndex + 10, '');
			}
		}

		// expressions that can just be removed outright
		const tsNodes = [
			'TSTypeParameterInstantiation',
			'TSTypeAnnotation',
			'TSTypeAliasDeclaration',
			'TSInterfaceDeclaration',
		];
		if (tsNodes.includes(node.type)) {
			src.update(node.start, node.end, '');
			return;
		}

		// remove type only imports
		if (node.type === 'ImportDeclaration') {
			// @ts-expect-error I promise you it does exist
			if (node.importKind === 'type') {
				src.update(node.start, node.end, '');
				return;
			}

			// @ts-expect-error I promise you it does exist
			const typeOnlySpecifiers = node.specifiers.filter((s) => s.importKind === 'type');

			// @ts-expect-error I promise you it does exist
			if (typeOnlySpecifiers.length === node.specifiers.length) {
				src.update(node.start, node.end, '');
				return;
			}

			for (let i = 0; i < typeOnlySpecifiers.length; i++) {
				const specifier = typeOnlySpecifiers[i];

				src.update(specifier.start, specifier.end, '');
			}

			return;
		}

		// remove any accessability modifiers from class property definitions
		// @ts-expect-error I promise you it does exist
		if (node.type === 'PropertyDefinition' && node.accessibility !== undefined) {
			// @ts-expect-error I promise you it does exist
			src.update(node.start, node.start + node.accessibility.length + 1, '');
		}

		// expressions are stripped by replacing their node with their expression
		const tsExpressions = ['TSAsExpression', 'TSNonNullExpression', 'TSTypeAssertion'];
		if (tsExpressions.includes(node.type)) {
			// @ts-expect-error I promise you it does exist
			src.update(node.start, node.end, src.slice(node.expression.start, node.expression.end));
			return;
		}

		// syntax that is unsupported results in an error
		const unsupportedSyntax = ['TSEnumDeclaration', 'TSParameterProperty'];
		if (unsupportedSyntax.includes(node.type)) {
			throw new Error(`Unsupported syntax! ${node.type} is not allowed!`);
		}
	};

	// strip script tag
	// @ts-expect-error It's fine dude
	walk(ast.instance, { enter });

	// strip <script module> tag
	// @ts-expect-error It's fine dude
	walk(ast.module, { enter });

	// strip templates
	// @ts-expect-error It's fine dude
	walk(ast.html, { enter });

	return src.toString();
}
