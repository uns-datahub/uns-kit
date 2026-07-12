# Assistant Workflow Examples

These examples use only the reusable package API and avoid UNS-specific
controller code.

- `support-agent.ts` defines a documentation support assistant, builds a
  definition package, and exports a smoke suite that can be run with fixture
  tool outputs.

Examples are repository-local for now. They are not included in the dry-run npm
tarball until package publish policy decides whether examples should ship with
the library.
