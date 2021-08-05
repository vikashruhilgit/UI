import { html, LitElement, property, state } from 'lit-element';
import { eventObj } from '../../utility/util.js';
import { gpayStyle } from './gpayStyle.js';

declare global {
  interface Window {
    google: any;
  }
}

export interface PaymentItem {
  label: string;
  type: string;
  price: string;
}

export interface TransactionData {
  displayItems: PaymentItem[];
  countryCode: string;
  currencyCode: string;
  totalPriceStatus: string;
  totalPrice: string;
  totalPriceLabel: string;
}

interface GError {
  status: boolean;
  msg: string;
  detailError?: any;
}

export class GooglePay extends LitElement {
  @property({ type: String }) clientId = '#698bvghhjbhGYvbjVH*75%Uyhfvbj98';
  @property({ type: Object }) transactionData: TransactionData | null = null;
  @property({ type: String }) redirectUrl = '';

  @state()
  private _error: GError = {
    status: false,
    msg: '',
  };

  _paymentsClient: any = null;
  _iframe: any;

  /**
   * Define the version of the Google Pay API referenced when creating your
   * configuration
   *
   * @see {@link https://developers.google.com/pay/api/web/reference/request-objects#PaymentDataRequest|apiVersion in PaymentDataRequest}
   */
  _baseRequest = {
    apiVersion: 2,
    apiVersionMinor: 0,
  };

  /**
   * Card networks supported by your site and your gateway
   *
   * @see {@link https://developers.google.com/pay/api/web/reference/request-objects#CardParameters|CardParameters}
   * @todo confirm card networks supported by your site and gateway
   */
  _allowedCardNetworks = ['AMEX', 'DISCOVER', 'JCB', 'MASTERCARD', 'VISA'];

  /**
   * Card authentication methods supported by your site and your gateway
   *
   * @see {@link https://developers.google.com/pay/api/web/reference/request-objects#CardParameters|CardParameters}
   * @todo confirm your processor supports Android device tokens for your
   * supported card networks
   */
  _allowedCardAuthMethods = ['PAN_ONLY', 'CRYPTOGRAM_3DS'];

  /**
   * Identify your gateway and your site's gateway merchant identifier
   *
   * The Google Pay API response will return an encrypted payment method capable
   * of being charged by a supported gateway after payer authorization
   *
   * @todo check with your gateway on the parameters to pass
   * @see {@link https://developers.google.com/pay/api/web/reference/request-objects#gateway|PaymentMethodTokenizationSpecification}
   */

  _tokenizationSpecification = {
    type: 'DIRECT',
    parameters: {
      protocolVersion: 'ECv2',
      publicKey: '',
      /* publicKey:
        'BNpvYANJS6oqUtOVokdm5pzJDGnQred/k66TUdlQs+lsZriZLIFxZZAFuIvoSefLgSZCvxhgn/sOP5Q10jUfip8=', */
    },
  };

  /* _tokenizationSpecification = {
    type: 'PAYMENT_GATEWAY',
    parameters: {
      gateway: 'globalpayments',
      gatewayMerchantId: '888000103376',
    },
  };
 */
  /**
   * Describe your site's support for the CARD payment method and its required
   * fields
   *
   * @see {@link https://developers.google.com/pay/api/web/reference/request-objects#CardParameters|CardParameters}
   */
  _baseCardPaymentMethod = {
    type: 'CARD',
    parameters: {
      allowedAuthMethods: this._allowedCardAuthMethods,
      allowedCardNetworks: this._allowedCardNetworks,
    },
  };

  /**
   * Describe your site's support for the CARD payment method including optional
   * fields
   *
   * @see {@link https://developers.google.com/pay/api/web/reference/request-objects#CardParameters|CardParameters}
   */
  _cardPaymentMethod = Object.assign({}, this._baseCardPaymentMethod, {
    tokenizationSpecification: this._tokenizationSpecification,
  });

  firstUpdated = () => {
    if (!this.clientId) {
      this._errorHandler({
        status: true,
        msg: 'missing clientId',
      });
    } else {
      this._getClientInfo(this.clientId);
    }
    this._gererateIframe();
    this._msgListener();
  };

  _checkAndLoadGooglePayButton = () => {
    if (
      window.google &&
      window.google.payments &&
      window.google.payments.api &&
      window.google.payments.api.PaymentsClient
    ) {
      this._onGooglePayLoaded();
    } else {
      const scriptElement = document.createElement('script');
      scriptElement.type = 'text/javascript';
      scriptElement.src = 'https://pay.google.com/gp/p/js/pay.js';
      document.head.appendChild(scriptElement);
      scriptElement.onload = this._onGooglePayLoaded;
    }
  };

  _getClientInfo = (clientId: string) => {
    setTimeout(() => {
      /* fakeRequest()
        .then((clientInfo: any) => { */
      this._setClientData({});
      this._checkAndLoadGooglePayButton();
      /* })
        .catch((err: Error) => {
          this._errorHandler({
            status: true,
            msg: err.message,
            detailError: err,
          });
        }); */
    }, 10);
  };

  _setClientData = (clientInfo: any) => {
    // console.log(clientInfo);
    this._tokenizationSpecification.parameters.publicKey =
      'BNpvYANJS6oqUtOVokdm5pzJDGnQred/k66TUdlQs+lsZriZLIFxZZAFuIvoSefLgSZCvxhgn/sOP5Q10jUfip8=';
  };

  _gererateIframe = () => {
    this._iframe = document.createElement('IFRAME');
    this._iframe.setAttribute('src', 'http://localhost:8080/');
    this._iframe.setAttribute('height', '0');
    this._iframe.setAttribute('width', '0');
    document.body.appendChild(this._iframe);
  };

  _msgListener = () => {
    window.onmessage = (e: any) => {
      console.log(e);
      if (e.origin.includes('http://localhost:8080')) {
        if (e.data.payload.SaleResponse.status === 'PASS') {
          const err = {
            transactionState: 'ERROR',
            error: {
              intent: 'PAYMENT_AUTHORIZATION',
              message: 'Insufficient funds',
              reason: 'PAYMENT_DATA_INVALID',
            },
            data: e.data,
          };
          // Things to do after un-successfull transaction from gateway
          this._errorHandler({
            status: true,
            msg: 'refer detail error',
            detailError: err,
          });
        } else {
          this.dispatchEvent(
            eventObj('payment-processed', {
              data: e.data,
              staus: 'payment done, response from service wrapper.',
            })
          );
        }
      }
    };
  };

  _onGooglePayLoaded = () => {
    const _paymentsClient = this._getGooglePaymentsClient();
    _paymentsClient
      .isReadyToPay(this._getGoogleIsReadyToPayRequest())
      .then((response: any) => {
        if (response.result) {
          this._addGooglePayButton();
          // @todo prefetch payment data to improve performance after confirming site functionality
          // prefetchGooglePaymentData();
        }
      })
      .catch((err: any) => {
        // show error in developer console for debugging
        console.error(err);
      });
  };

  _getGoogleIsReadyToPayRequest = () => {
    return Object.assign({}, this._baseRequest, {
      allowedPaymentMethods: [this._baseCardPaymentMethod],
    });
  };

  /* _registredMerchantInfo = {
    merchantName: 'Example Merchant',
    merchantId: '01234567890123456789',
  }; */

  _googleMerchantInfo = {
    // @todo a merchant ID is available for a production environment after approval by Google
    // See {@link https://developers.google.com/pay/api/web/guides/test-and-deploy/integration-checklist|Integration checklist}
    merchantId: '01234567890123456789',
    merchantName: 'Firstech',
  };

  _registredMerchantInfo = this._googleMerchantInfo;

  _getGooglePaymentsClient = () => {
    if (this._paymentsClient === null) {
      this._paymentsClient = new window.google.payments.api.PaymentsClient({
        environment: 'TEST', // PRODUCTION
        merchantInfo: this._registredMerchantInfo,
        paymentDataCallbacks: {
          onPaymentAuthorized: this._onPaymentAuthorized,
          // onPaymentDataChanged: onPaymentDataChanged,
        },
      });
    }
    return this._paymentsClient;
  };

  _addGooglePayButton = () => {
    const paymentsClient = this._getGooglePaymentsClient();

    const button = paymentsClient.createButton({
      onClick: this._onGooglePaymentButtonClicked,
    });

    const el = this.shadowRoot?.getElementById('google-pay');
    if (el) {
      el.appendChild(button);
    }
  };

  _onGooglePaymentButtonClicked = () => {
    const paymentDataRequest = this._getGooglePaymentDataRequest();
    paymentDataRequest.transactionInfo = this._getGoogleTransactionInfo();

    const paymentsClient = this._getGooglePaymentsClient();
    paymentsClient
      .loadPaymentData(paymentDataRequest)
      .then((val: any) => {
        console.log('--loadPaymentData called--');
      })
      .catch((err: Error) => {
        this._errorHandler({
          status: true,
          msg: 'refer detail error',
          detailError: err,
        });
      });
  };

  _getGooglePaymentDataRequest = () => {
    const paymentDataRequest: any = Object.assign({}, this._baseRequest);
    paymentDataRequest.allowedPaymentMethods = [this._cardPaymentMethod];
    paymentDataRequest.transactionInfo = this._getGoogleTransactionInfo();
    paymentDataRequest.merchantInfo = this._googleMerchantInfo;
    paymentDataRequest.callbackIntents = ['PAYMENT_AUTHORIZATION'];

    return paymentDataRequest;
  };

  _getGoogleTransactionInfo = () => {
    return this.transactionData;
  };

  _onPaymentAuthorized = (paymentData: any) => {
    this._iframe.contentWindow.postMessage(
      {
        action: 'gpayload',
        payload: {
          paymentData: paymentData,
          transactionData: this.transactionData,
        },
      },
      'http://localhost:8080/'
    );
  };

  _errorHandler = (err: GError) => {
    this._error = {
      ...err,
    };
    this.dispatchEvent(eventObj('error', err));
  };

  _refreshButton = () => {
    this._error = {
      status: false,
      msg: '',
    };
    const el = this.shadowRoot?.getElementById('google-pay');
    if (el) {
      el.innerHTML = '';
      this._paymentsClient = null;
      this._onGooglePayLoaded();
    }
  };

  render = () => {
    return html`
      <style>
        ${gpayStyle}
      </style>
      <div id="google-pay"></div>
      ${this._error.status
        ? html`
            <!-- <span
              >Something went wrong. Try again.<span
                @click=${this._refreshButton}
                >Refresh</span
              ></span
            > -->
          `
        : null}
    `;
  };
}
