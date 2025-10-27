(() => {
    const rootEl = document;
    rootEl.addEventListener('change', async (e) => {
      const cb = e.target.closest('.embx-toggle');
      if (!cb) return;

      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
  
      const row = e.target.closest('tr.cart-item');
      if (!row) return;
  
      const group = row.dataset.embxGroup || '';
      const productUrl = row.dataset.productUrl || '/';
      
      if (cb.checked) {
        // Open inline embroidery modal in cart instead of redirect
        cb.checked = false;
        const modal = row.querySelector('[data-embx-modal]');
        if (!modal) return;

        // Prefill from existing properties if any
        const nameInput = modal.querySelector('.embx-input-name');
        const colourInput = modal.querySelector(`input.embx-input-colour[name^="embx-colour-"][value="${(row.querySelector('.product-option')?.textContent || '').trim()}"]`);
        if (nameInput && row.dataset.embxGroup) {
          // We will fetch current cart state to prefill exact values
          try {
            const cart = await fetch('/cart.js').then(r => r.json());
            const mainLine = cart.items.find(it => it.key === row.dataset.lineKey);
            if (mainLine) {
              if (mainLine.properties && mainLine.properties['Name to embroider']) {
                nameInput.value = mainLine.properties['Name to embroider'];
              }
              if (mainLine.properties && mainLine.properties['Colour']) {
                const radio = modal.querySelector(`input.embx-input-colour[name^="embx-colour-"][value="${mainLine.properties['Colour']}"]`);
                if (radio) radio.checked = true;
              }
              if (mainLine.properties && mainLine.properties['Font']) {
                const radioF = modal.querySelector(`input.embx-input-font[name^="embx-font-"][value="${mainLine.properties['Font']}"]`);
                if (radioF) radioF.checked = true;
              }
            }
          } catch (_) {}
        }

        modal.classList.remove('hidden');

        // Prevent bubbling from form inputs inside modal to cart listeners
        const stopEvents = (ev) => {
          ev.stopPropagation();
          ev.stopImmediatePropagation?.();
        };
        modal.querySelectorAll('.embx-input-name, .embx-input-colour, .embx-input-font').forEach((el) => {
          ['change', 'input', 'click'].forEach((type) => el.addEventListener(type, stopEvents));
        });

        const onCancel = () => {
          modal.classList.add('hidden');
        };

        const onSave = async () => {
          const cart = await fetch('/cart.js').then(r => r.json());
          const mainLine = cart.items.find(it => it.key === row.dataset.lineKey);
          if (!mainLine) { modal.classList.add('hidden'); return; }
          const qty = mainLine.quantity;
          const feeVariantId = Number(modal.dataset.feeVariantId);
          const group = mainLine.properties && mainLine.properties._embx_group ? mainLine.properties._embx_group : ('embx-' + Math.random().toString(36).slice(2,10));
          const nameVal = modal.querySelector('.embx-input-name')?.value?.trim() || '';
          const colourVal = modal.querySelector('.embx-input-colour:checked')?.value || '';
          const fontVal = modal.querySelector('.embx-input-font:checked')?.value || '';
          if (!nameVal) {
            alert('Please enter a name to embroider.');
            return;
          }

          // Ensure fee line exists
          let feeLine = cart.items.find(it => it.properties && it.properties._fee === 'embroidery' && it.properties._embx_group === group);
          if (!feeLine && feeVariantId) {
            await fetch('/cart/add.js', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ items: [{ id: feeVariantId, quantity: qty, properties: { _fee: 'embroidery', _embx_group: group } }] })
            });
          }

          const updatedProperties = { ...mainLine.properties, Embroidery: 'Yes', 'Name to embroider': nameVal, Colour: colourVal, Font: fontVal, _embx_group: group };
          await fetch('/cart/change.js', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: mainLine.key, quantity: qty, properties: updatedProperties })
          });

        	modal.classList.add('hidden');
          window.location.reload();
        };

        modal.querySelector('.embx-cancel')?.addEventListener('click', onCancel, { once: true });
        modal.querySelector('.embx-save')?.addEventListener('click', onSave, { once: true });
        return;
      }
  
      // Prevent checkbox from changing immediately
      cb.checked = true;
      
      try {
        const cart = await fetch('/cart.js').then(r => r.json());
        const feeLine = cart.items.find(it =>
          it.properties && it.properties._fee === 'embroidery' && it.properties._embx_group === group
        );
        const mainLine = cart.items.find(it =>
          it.properties && it.properties._embx_group === group && it.properties._fee !== 'embroidery'
        );
        
        if (!feeLine) {
          cb.checked = false;
          return;
        }

        await fetch('/cart/change.js', {
          method: 'POST',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify({ id: feeLine.key, quantity: 0 })
        });

        if (mainLine) {
          const updatedProperties = { ...mainLine.properties };
          updatedProperties.Embroidery = null;
          updatedProperties['Name to embroider'] = null;
          updatedProperties.Colour = null;
          updatedProperties.Font = null;
          updatedProperties._embx_group = null;

          await fetch('/cart/change.js', {
            method: 'POST',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ 
              id: mainLine.key, 
              quantity: mainLine.quantity,
              properties: updatedProperties
            })
          }).then(res => res.json()).then(data => {
            // reload the page
            window.location.reload();
          }).catch(err => {
            console.error('[embx] change error', err);
            cb.checked = true; // Revert on error
          });
        }

      } catch (err) {
        console.error('[embx] toggle error', err);
        cb.checked = true; // Revert on error
      }
    }, true);
  
    rootEl.addEventListener('click', async (e) => {
      const btn = e.target.closest('cart-remove-button a, a[href*="/cart/change"]');
      if (!btn) return;
  
      const row = e.target.closest('tr.cart-item');
      if (!row) return;
  
      const group = row.dataset.embxGroup || '';
      if (!group) return;
  
      e.preventDefault();

      try {
        const cart = await fetch('/cart.js').then(r => r.json());

        const feeLine = cart.items.find(it =>
          it.properties && it.properties._fee === 'embroidery' && it.properties._embx_group === group
        );
        const mainKey = row.dataset.lineKey;

        if (feeLine?.key) {
          await fetch('/cart/change.js', {
            method: 'POST',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ id: feeLine.key, quantity: 0 })
          });
        }

        if (mainKey) {
          await fetch('/cart/change.js', {
            method: 'POST',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ id: mainKey, quantity: 0 })
          });
        } else {
          window.location.href = btn.getAttribute('href');
          return;
        }
      } catch (err) {
        console.error('[embx] remove pair error', err);
        window.location.reload();
      }
    });
  })();
  