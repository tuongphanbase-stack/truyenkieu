# Apply cultural deep-reading batch

Copy these files into the repository:
- `js/cultural-layers.js`
- `css/cultural-layers.css`
- `tests/cultural-layers.test.js`

Then update `index.html`:

1. After:
```html
<link rel="stylesheet" href="css/narrative-layers.css?v=20260827-34">
```
add:
```html
<link rel="stylesheet" href="css/cultural-layers.css?v=20260827-35">
```

2. Keep `js/cultural-layers.js` **after** `js/explanation-layout.js` because it decorates the existing `readerInsightPieces()` function. Replace the final layout tag:
```html
<script src="js/explanation-layout.js?v=20260827-34"></script>
```
with:
```html
<script src="js/explanation-layout.js?v=20260827-34"></script><script src="js/cultural-layers.js?v=20260827-35"></script>
```

Verification:
```bash
node --check js/cultural-layers.js
node tests/cultural-layers.test.js
```
