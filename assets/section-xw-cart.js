class XWCartRemoveButton extends HTMLElement {
    constructor() {
        super();

        this.addEventListener('click', (event) => {
            event.preventDefault();
            const cartItems = this.closest('section-xw-cart-container');
            cartItems.updateQuantity(this.dataset.index, 0);
        });
    }
}

customElements.define('xw-cart-remove-button', XWCartRemoveButton);

class XWCartItems extends HTMLElement {
    constructor() {
        super();
        this.lineItemStatusElement =
            document.getElementById('shopping-cart-line-item-status') || document.getElementById('CartDrawer-LineItemStatus');

        const debouncedOnChange = debounce((event) => {
            this.onChange(event);
        }, ON_CHANGE_DEBOUNCE_TIMER);

        this.addEventListener('change', debouncedOnChange.bind(this));
    }

    cartUpdateUnsubscriber = undefined;

    connectedCallback() {
        this.cartUpdateUnsubscriber = subscribe(PUB_SUB_EVENTS.cartUpdate, (event) => {
            if (event.source === 'cart-items') {
                return;
            }
            this.onCartUpdate();
        });
    }

    disconnectedCallback() {
        if (this.cartUpdateUnsubscriber) {
            this.cartUpdateUnsubscriber();
        }
    }

    resetQuantityInput(id) {
        const input = this.querySelector(`#Quantity-${id}`);
        input.value = input.getAttribute('value');
        this.isEnterPressed = false;
    }

    setValidity(event, index, message) {
        event.target.setCustomValidity(message);
        event.target.reportValidity();
        this.resetQuantityInput(index);
        event.target.select();
    }

    validateQuantity(event) {
        const inputValue = parseInt(event.target.value);
        const index = event.target.dataset.index;
        let message = '';

        if (inputValue < event.target.dataset.min) {
            message = window.quickOrderListStrings.min_error.replace('[min]', event.target.dataset.min);
        } else if (inputValue > parseInt(event.target.max)) {
            message = window.quickOrderListStrings.max_error.replace('[max]', event.target.max);
        } else if (inputValue % parseInt(event.target.step) !== 0) {
            message = window.quickOrderListStrings.step_error.replace('[step]', event.target.step);
        }

        if (message) {
            this.setValidity(event, index, message);
        } else {
            event.target.setCustomValidity('');
            event.target.reportValidity();
            this.updateQuantity(
                index,
                inputValue,
                document.activeElement.getAttribute('name'),
                event.target.dataset.quantityVariantId
            );
        }
    }

    onChange(event) {
        this.validateQuantity(event);
    }

    onCartUpdate() {
        if (this.tagName === 'CART-DRAWER-ITEMS') {
            fetch(`${routes.cart_url}?section_id=cart-drawer`)
                .then((response) => response.text())
                .then((responseText) => {
                    const html = new DOMParser().parseFromString(responseText, 'text/html');
                    const selectors = ['cart-drawer-items', '.cart-drawer__footer'];
                    for (const selector of selectors) {
                        const targetElement = document.querySelector(selector);
                        const sourceElement = html.querySelector(selector);
                        if (targetElement && sourceElement) {
                            targetElement.replaceWith(sourceElement);
                        }
                    }
                })
                .catch((e) => {
                    console.error(e);
                });
        } else {
            fetch(`${routes.cart_url}?section_id=main-cart-items`)
                .then((response) => response.text())
                .then((responseText) => {
                    const html = new DOMParser().parseFromString(responseText, 'text/html');
                    const sourceQty = html.querySelector('cart-items');
                    this.innerHTML = sourceQty.innerHTML;
                })
                .catch((e) => {
                    console.error(e);
                });
        }
    }

    getSectionsToRender() {
        return [
            {
                id: 'body-products',
                section: document.querySelector('.body-products').dataset.id,
                selector: '.body-products',
            }
        ];
    }

    formatPrice(value) {
        if (!value) return '¥' + 0.00;

        let rounded = value.toFixed(2);

        return '¥' + Number(rounded).toLocaleString();
    }

    updateQuantity(line, quantity, name, variantId) {
        debugger
        // this.enableLoading(line);

        const body = JSON.stringify({
            line,
            quantity,
            sections: this.getSectionsToRender().map((section) => section.section),
            sections_url: window.location.pathname,
        });

        fetch(`${routes.cart_change_url}`, { ...fetchConfig(), ...{ body } })
            .then((response) => {
                return response.text();
            })
            .then((state) => {
                const parsedState = JSON.parse(state);

                const { original_total_price, items_subtotal_price, total_discount } = parsedState || {}

                const originalTotalPriceEle = document.querySelector('.body-bill .subtotal-trans-money')

                originalTotalPriceEle.innerText = this.formatPrice(original_total_price)

                const subtotalPriceEle = document.querySelector('.body-bill .total-wrap .total-money .trans-money')

                subtotalPriceEle.innerText = this.formatPrice(items_subtotal_price)

                const final_line_priceEle = document.querySelector(`#productItem-${line} .product-desc .price-wrap .current-price`)
                const original_line_priceEle = document.querySelector(`#productItem-${line} .product-desc .price-wrap .original-price`)
                const line_level_total_discountEle = document.querySelector(`#productItem-${line} .product-desc .price-wrap .save-fees`)

                final_line_priceEle.innerText = this.formatPrice(items_subtotal_price)
                original_line_priceEle.innerText = this.formatPrice(original_total_price)
                line_level_total_discountEle.innerText = this.formatPrice(total_discount)

                const quantityElement =
                    document.getElementById(`Quantity-${line}`);

                if (parsedState.errors) {
                    quantityElement.value = quantityElement.getAttribute('value');

                    this.updateLiveRegions(line, parsedState.errors);

                    return;
                }

                // this.updateLiveRegions(line, message);

            })
            .catch(() => {
                this.querySelectorAll('.loading__spinner').forEach((overlay) => overlay.classList.add('hidden'));
                const errors = document.getElementById('cart-errors') || document.getElementById('CartDrawer-CartErrors');
                errors.textContent = window.cartStrings.error;
            })
            .finally(() => {
                this.disableLoading(line);
            });
    }

    updateLiveRegions(line, message) {
        const lineItemError =
            document.getElementById(`Line-item-error-${line}`) || document.getElementById(`CartDrawer-LineItemError-${line}`);
        if (lineItemError) lineItemError.querySelector('.cart-item__error-text').textContent = message;

        this.lineItemStatusElement.setAttribute('aria-hidden', true);

        const cartStatus =
            document.getElementById('cart-live-region-text') || document.getElementById('CartDrawer-LiveRegionText');
        cartStatus.setAttribute('aria-hidden', false);

        setTimeout(() => {
            cartStatus.setAttribute('aria-hidden', true);
        }, 1000);
    }

    getSectionInnerHTML(html, selector) {
        return new DOMParser().parseFromString(html, 'text/html').querySelector(selector).innerHTML;
    }

    enableLoading(line) {
        const mainCartItems = document.getElementById('main-cart-items') || document.getElementById('CartDrawer-CartItems');
        mainCartItems.classList.add('cart__items--disabled');

        const cartItemElements = this.querySelectorAll(`#CartItem-${line} .loading__spinner`);
        const cartDrawerItemElements = this.querySelectorAll(`#CartDrawer-Item-${line} .loading__spinner`);

        [...cartItemElements, ...cartDrawerItemElements].forEach((overlay) => overlay.classList.remove('hidden'));

        document.activeElement.blur();
        this.lineItemStatusElement.setAttribute('aria-hidden', false);
    }

    disableLoading(line) {
        const mainCartItems = document.getElementById('main-cart-items') || document.getElementById('CartDrawer-CartItems');
        mainCartItems.classList.remove('cart__items--disabled');

        const cartItemElements = this.querySelectorAll(`#CartItem-${line} .loading__spinner`);
        const cartDrawerItemElements = this.querySelectorAll(`#CartDrawer-Item-${line} .loading__spinner`);

        cartItemElements.forEach((overlay) => overlay.classList.add('hidden'));
        cartDrawerItemElements.forEach((overlay) => overlay.classList.add('hidden'));
    }
}

customElements.define('section-xw-cart-container', XWCartItems);

if (!customElements.get('cart-note')) {
    customElements.define(
        'cart-note',
        class CartNote extends HTMLElement {
            constructor() {
                super();

                this.addEventListener(
                    'input',
                    debounce((event) => {
                        const body = JSON.stringify({ note: event.target.value });
                        fetch(`${routes.cart_update_url}`, { ...fetchConfig(), ...{ body } });
                    }, ON_CHANGE_DEBOUNCE_TIMER)
                );
            }
        }
    );
}
