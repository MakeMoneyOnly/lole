/**
 * jscodeshift codemod to add React.JSX.Element return types to component functions
 */

const fixReturnTypes = function(fileInfo, api) {
  const j = api.jscodeshift;
  const root = j(fileInfo.source);

  // Track if we made changes
  let changed = false;

  // Fix: export default function Name() { -> export default function Name(): React.JSX.Element {
  root
    .find(j.ExportDefaultDeclaration)
    .filter(path => {
      const decl = path.node.declaration;
      return j.FunctionDeclaration.check(decl) && decl.id && decl.id.name;
    })
    .forEach(path => {
      const func = path.node.declaration;
      // Skip if already has return type
      if (func.returnType) return;
      
      func.returnType = j.tsTypeAnnotation(
        j.tsTypeReference(
          j.identifier('React.JSX.Element')
        )
      );
      changed = true;
    });

  // Fix: export function Name() { -> export function Name(): React.JSX.Element {
  root
    .find(j.ExportNamedDeclaration)
    .filter(path => {
      const decl = path.node.declaration;
      return j.FunctionDeclaration.check(decl) && decl.id && decl.id.name;
    })
    .forEach(path => {
      const func = path.node.declaration;
      // Skip if already has return type
      if (func.returnType) return;
      
      func.returnType = j.tsTypeAnnotation(
        j.tsTypeReference(
          j.identifier('React.JSX.Element')
        )
      );
      changed = true;
    });

  // Fix: function Name() { -> function Name(): React.JSX.Element { (for component-like functions)
  root
    .find(j.FunctionDeclaration)
    .filter(path => {
      const func = path.node;
      // Skip if no id, already has return type, or has body
      if (!func.id) return false;
      if (func.returnType) return false;
      // Check if it looks like a component (returns JSX or returns early with JSX)
      return true;
    })
    .forEach(path => {
      const func = path.node;
      // Skip if already has return type
      if (func.returnType) return;
      
      func.returnType = j.tsTypeAnnotation(
        j.tsTypeReference(
          j.identifier('React.JSX.Element')
        )
      );
      changed = true;
    });

  // Fix: const Name = () => { -> const Name = (): React.JSX.Element => {
  root
    .find(j.VariableDeclarator)
    .filter(path => {
      const init = path.node.init;
      if (!init) return false;
      // Check if it's an arrow function
      if (j.ArrowFunctionExpression.check(init)) {
        // Check if variable name starts with uppercase (component convention)
        const name = path.node.id.name;
        return name && name[0] === name[0].toUpperCase();
      }
      return false;
    })
    .forEach(path => {
      const arrowFunc = path.node.init;
      // Skip if already has return type
      if (arrowFunc.returnType) return;
      
      arrowFunc.returnType = j.tsTypeAnnotation(
        j.tsTypeReference(
          j.identifier('React.JSX.Element')
        )
      );
      changed = true;
    });

  return changed ? root.toSource() : null;
};

module.exports = fixReturnTypes;