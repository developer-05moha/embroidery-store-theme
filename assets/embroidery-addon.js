(() => {
  const roots = document.querySelectorAll('[data-embx]');
  if (!roots.length) return;

  roots.forEach((root) => attach(root));

  function attach(root) {
    const check = root.querySelector('#embx-check');
    const panel = root.querySelector('#embx-panel');
    const textField = root.querySelector('#embx-text');

    check?.addEventListener('change', () => {
      panel?.classList.toggle('hidden', !check.checked);
    });

    const nearestContainer =
      root.closest('product-form') ||
      root.closest('[data-product-form]') ||
      root.closest('section') ||
      document;

    const productForm =
      nearestContainer.querySelector('product-form form[action*="/cart/add"]') ||
      nearestContainer.querySelector('form[action*="/cart/add"]') ||
      document.querySelector('product-form form[action*="/cart/add"]') ||
      document.querySelector('form[action*="/cart/add"]');

    if (!productForm) {
      console.warn('[Embroidery] Product form not found near UI.');
      return;
    }

    // Prefer intercepting submit early (capture) to beat Dawn’s handler
    const onSubmit = async (event) => {
      // If no embroidery selected, allow native flow
      if (!check?.checked) return;

      event.preventDefault();
      event.stopImmediatePropagation();

      // Basic validation
      const max = parseInt(textField?.getAttribute('maxlength') || '10', 10);
      const cleanName = textField?.value || '';
      if (!cleanName) {
        alert('Please enter a name to embroider.');
        return;
      }

      // Quantity & variants
      const qty = productForm.querySelector('input[name="quantity"]')?.value || 1;
      const mainVariantId = productForm.querySelector('input[name="id"]')?.value;
      const gid = root.dataset.feeVariantGid;
      const id = gid.split('/').pop();
      const feeVariantId = Number(id);

      // Selections
      const selectedColor = root.querySelector('input[name="embx-colour"]:checked')?.value || '';
      const selectedFont  = root.querySelector('input[name="embx-font"]:checked')?.value || '';

      const group = 'embx-' + Math.random().toString(36).slice(2, 10);
      // Build payload: main + fee
      const items = [
        {
          id: mainVariantId,
          quantity: qty,
          properties: {
            Embroidery: 'Yes',
            'Name to embroider': cleanName,
            Colour: selectedColor,
            Font: selectedFont,
            _embx_group: group
          }
        },
        {
          id: feeVariantId,
          quantity: qty,
          properties: { _fee: 'embroidery', _embx_group: group }
        }
      ];

      try {
        const res = await fetch('/cart/add.js', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items })
        });
        if (!res.ok) throw new Error(`Add to cart failed (${res.status})`);

        window.location.href = '/cart';
      } catch (e) {
        alert('Failed to add to cart.');
        return;
      }
    };
    productForm.addEventListener('submit', onSubmit, true);

  }
})();
