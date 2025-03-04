import {LitElement, html, css} from 'lit';
import {allConfiguration} from 'devui-data';
import { JsonRpc } from 'jsonrpc';
import {until} from 'lit/directives/until.js';
import '@vaadin/grid';
import 'qui/qui-alert.js';
import {columnBodyRenderer} from '@vaadin/grid/lit.js';
import '@vaadin/grid/vaadin-grid-sort-column.js';
import '@vaadin/icon';
import '@vaadin/tooltip';
import '@vaadin/checkbox';
import '@vaadin/number-field';
import '@vaadin/integer-field';
import '@vaadin/text-field';
import '@vaadin/select';
import '@vaadin/vertical-layout';
import '@vaadin/horizontal-layout';
import '@vaadin/details';
import { QuiAlert} from "qui/qui-alert.js";
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import {gridRowDetailsRenderer} from '@vaadin/grid/lit.js';

/**
 * This component allows users to change the configuration
 */
export class QwcConfiguration extends LitElement {

    jsonRpc = new JsonRpc("ConfigJsonRpcService");

    static styles = css`
      vaadin-grid {
        height: 100%;
      }

      vaadin-grid-cell-content {
        vertical-align: top;
        width: 100%;
      }

      .description {
        padding: 1em;
      }

      .input-column {
        width: 100%;
        vertical-align: top;
      }

      .top-align {
        vertical-align: top;
      }
      
      .full-height {
        height: 100%;
      }

      .save-button {
        background-color: transparent;
        cursor: pointer;
        color: var(--lumo-primary-color);
      }
      
      .lock-icon {
        color: var(--lumo-error-color-50pct);
        font-size: small;
      }
      .unlock-icon {
        color: var(--lumo-success-color-50pct);
        font-size: small;
      }
    `;

    static properties = {
        _configurations: {state: true, type: Array},
        _filtered: {state: true, type: Array},
        _values: {state: true},
        _message: {state: true},
        _detailsOpenedItem: {state: true, type: Array}
    };

    constructor() {
        super();
        this._configurations = allConfiguration;
        this._filtered = allConfiguration;
        this.jsonRpc.getAllValues().then(e => {
            this._values = e.result;
        });
        this._detailsOpenedItem = [];
    }

    render() {
        return html`${until(this._render(), html`<span>Loading configuration properties...</span>`)}`;
    }

    _match(value, term) {
        if (! value) {
            return false;
        }
        return value.toLowerCase().includes(term.toLowerCase());
    }

    _filter(e) {
        const searchTerm = (e.detail.value || '').trim();
        if (searchTerm === '') {
            this._filtered = this._configurations;
            return;
        }

        this._filtered = this._configurations.filter((prop) => {
           return  this._match(prop.name, searchTerm) || this._match(prop.description, searchTerm)
        });
    }

    _render() {
        if (this._filtered  && this._values) {
            return html`
                ${this._message}
                <vaadin-text-field
                        placeholder="Search"
                        style="width: 50%;"
                        @value-changed="${(e) => this._filter(e)}">
                    <vaadin-icon slot="prefix" icon="font-awesome-solid:magnifying-glass"></vaadin-icon>
                </vaadin-text-field>
                <vaadin-grid .items="${this._filtered}" style="width: 100%;" class="datatable" theme="row-stripes"
                             .detailsOpenedItems="${this._detailsOpenedItem}"
                            @active-item-changed="${(event) => {
                            const prop = event.detail.value;
                            this._detailsOpenedItem = prop ? [prop] : [];
                        }}"
                        ${gridRowDetailsRenderer(this._descriptionRenderer, [])}
                >
                    <vaadin-grid-sort-column auto-width class="cell" flex-grow="0" path="configPhase" header='Phase'
                                        ${columnBodyRenderer(this._lockRenderer, [])}>
                    </vaadin-grid-sort-column>

                    <vaadin-grid-sort-column auto-width flex-grow="0"
                                        header="Name" 
                                        path="name"
                                        class="cell"
                                        ${columnBodyRenderer(this._nameRenderer, [])}>
                    </vaadin-grid-sort-column>

                    <vaadin-grid-column
                                        class="cell"
                                        header="Value"
                                        ${columnBodyRenderer(this._valueRenderer, [])}>
                    </vaadin-grid-column>
                </vaadin-grid>`;
        }
    }

    _lockRenderer(prop) {
        if (prop.configPhase === "BUILD_AND_RUN_TIME_FIXED" || prop.configPhase === "BUILD_TIME") {
            return html`
                <vaadin-icon theme="small" class="lock-icon" id="icon-lock-${prop.name}" icon="font-awesome-solid:lock"></vaadin-icon>
                <vaadin-tooltip for="icon-lock-${prop.name}" text="Fixed at build time (not overridable at runtime)"
                                position="top-start"></vaadin-tooltip>
            `
        } else {
            return html`
                <vaadin-icon theme="small" class="unlock-icon" id="icon-lock-${prop.name}" icon="font-awesome-solid:lock-open"></vaadin-icon>
                <vaadin-tooltip for="icon-lock-${prop.name}" text="Overridable at runtime"
                                position="top-start"></vaadin-tooltip>
            `
        }
    }

    _nameRenderer(prop) {
        let devservice = "";
        let wildcard = "";
        if (prop.autoFromDevServices) {
            devservice = html`
                <vaadin-icon id="icon-dev-${prop.name}" icon="font-awesome-solid:magic"></vaadin-icon>
                <vaadin-tooltip for="icon-dev-${prop.name}" text="Automatically set by Dev Services"
                                position="top-start"></vaadin-tooltip>
            `
        }

        if (prop.wildcardEntry) {
            wildcard = html`
                <vaadin-icon id="icon-wc-${prop.name}" icon="font-awesome-solid:plus"></vaadin-icon>
                <vaadin-tooltip for="icon-wc-${prop.name}" text="This will add a new named config group"
                                position="top-start"></vaadin-tooltip>
            `
        }

        return html`
            <code${prop.name}</code>${devservice}${wildcard}`;
    }

    _valueRenderer(prop) {
        let def = '';
        if (prop.defaultValue) {
            def = "Default value: " + prop.defaultValue;
        } else {
            def = "No default value";
        }

        let actualValue = this._values[prop.name];
        if (!actualValue) {
            actualValue = prop.defaultValue;
        }

        if (prop.wildcardEntry) {
            // TODO
        } else if (prop.typeName === "java.lang.Boolean") {
            return html`
                <vaadin-checkbox theme="small"
                                 @change="${(event) => {
                                     this._updateBooleanProperty(prop, event, event.target.checked);
                                 }}"
                                 checked="${actualValue === 'true'}">
                    <vaadin-tooltip slot="tooltip" text="${def}"></vaadin-tooltip>
                </vaadin-checkbox>`
        } else if (prop.typeName === "java.lang.Integer" || prop.typeName === "java.lang.Long") {
            return html`
                <vaadin-integer-field class="input-column top-align"
                                      placeholder="${prop.defaultValue}"
                                      value="${actualValue}"
                                      theme="small" helper-text="${def}"
                                      id="input-${prop.name}">
                    <vaadin-icon slot="suffix" icon="font-awesome-solid:floppy-disk" class="save-button"
                                 id="save-button-${prop.name}"
                                 @click="${(e) => this._updateTextProperty(prop, e)}"></vaadin-icon>
                </vaadin-integer-field>`
        } else if (prop.typeName === "java.lang.Float" || prop.typeName === "java.lang.Double") {
            return html`
                <vaadin-number-field class="input-column top-align" 
                                     theme="small" id="input-${prop.name}" placeholder="${prop.defaultValue}" 
                                     value="${actualValue}"
                                     helper-text="${def}">
                    <vaadin-icon slot="suffix" icon="font-awesome-solid:floppy-disk" class="save-button"
                                 id="save-button-${prop.name}" @click="${(e) => this._updateTextProperty(prop, e)}"></vaadin-icon>
                </vaadin-number-field>`
        } else if (prop.typeName === "java.lang.Enum" || prop.typeName === "java.util.logging.Level") {
            let items = [];
            let defaultValue = '';
            for (let idx in prop.allowedValues) {
                if (prop.allowedValues[idx] === actualValue) {
                    defaultValue = prop.allowedValues[idx];
                }
                items.push({
                    'label': prop.allowedValues[idx],
                    'value': prop.allowedValues[idx],
                });
            }
            if (! defaultValue) {
                defaultValue = prop.defaultValue;
            }
            return html`
                <vaadin-select theme="small" .items="${items}" .value="${defaultValue}" helper-text="${def}"
                               @change="${(event) => {
                                   this._updateTextProperty(prop, event, event.target.value);
                               }}"
                >
                </vaadin-select>
            `
        } else {
            return html`
                <vaadin-text-field class="input-column top-align" theme="small" value="${actualValue}" helper-text="${def}"
                                   placeholder="${prop.defaultValue}" id="input-${prop.name}">
                        <vaadin-icon slot="suffix" icon="font-awesome-solid:floppy-disk" class="save-button" 
                                     id="save-button-${prop.name}" @click="${(e) => this._updateTextProperty(prop, e)}"></vaadin-icon>
                    </vaadin-button>
                </vaadin-text-field>
            `
        }
    }

    _descriptionRenderer(prop) {
        let val = prop.name;
        let res = "";
        for (let i = 0; i < val.length; i++) {
            let c = val.charAt(i);
            if ('a' <= c && c <= 'z' || 'A' <= c && c <= 'Z' || '0' <= c && c <= '9') {
                res = res + c;
            } else {
                res = res + '_';
                if (c === '"'  && i + 1 === val.length) {
                    res = res + '_';
                }
            }
        }
        res = res.toUpperCase();
        let env = html`
        <div>
            <span><strong>Environment variable: </strong></span><code>${res}</code>
        </div>`
        return html`<div class="description"><p>${unsafeHTML(prop.description)}</p>${env}</div>`;
    }

    _updateTextProperty(property, event, val) {
        event.preventDefault();
        let value = val;
        if (!val) {
            const input = this.shadowRoot.getElementById("input-" + property.name);
            value = input.value;
        }
        this.jsonRpc.updateProperty({
            'name': property.name,
            'value': value
        }).then(e => {
            this._values[property.name] = value;
            this._message = html`<qui-alert theme="success" dismissible content="Property <code>${property.name}</code> updated."></qui-alert>`
        })
    }
    _updateBooleanProperty(property, event, value) {
        event.preventDefault();
        this.jsonRpc.updateProperty({
            'name': property.name,
            'value': value.toString()
        }).then(e => {
            this._values[property.name] = value;
            this._message = html`<qui-alert theme="success" dismissible content="Property <code>${property.name}</code> updated."></qui-alert>`
        });
    }

}

customElements.define('qwc-configuration', QwcConfiguration);