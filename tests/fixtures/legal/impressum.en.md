## Test Imprint

This is the **English** imprint fixture used by the Playwright e2e suite.

[Safe corporate link](https://example.com/legal)

Contact us at [email](mailto:legal@example.com).

### Operator

Example Corp, 12 Test Street, 12345 Testcity

<!-- XSS proof: the lines below must render INERT when served through the sanitizer -->
<script>alert("xss-script-tag")</script>
<img src="x" onerror="alert('img-onerror')">
[JS link](javascript:alert(1))
[Data link](data:text/html,<script>alert(1)</script>)
