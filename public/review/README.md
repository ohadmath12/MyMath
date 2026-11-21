# Empty-form review gallery

Open index.html through the site (not as a file URL). Select a form and jump to any stage without entering personal data. Each stage has a shareable URL fragment.

The gallery uses the existing HTML/CSS for fields and terms. Dynamic checkout and result panels are explicitly illustrative. No production scripts, invitation tokens, APIs, real checkout links, or customer records are loaded. An empty iframe sandbox and restrictive child CSP block scripting, requests, form submission, and popups. All values are ephemeral and disappear when moving to another stage.

This is a visual review workspace, not an end-to-end payment test. Provider migration planning is documented separately in docs/forms-review-and-provider-boundary.md.
