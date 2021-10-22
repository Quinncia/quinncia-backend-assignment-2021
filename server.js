import Koa from 'koa';
import Router from '@koa/router';

const app = new Koa();

const port = 3011;
const EMAIL_SERVICE_PROVIDER = 'https://gmail.com';

const router = new Router({
  prefix: '/v0.1',
});

/** Please do not attempt to execute this code. This is not the purpose of this assignment */
/** Just make corrections and send it over to us, or just list things that you would change here */
/** Consider that it should be production-ready */
router.get('/money-exchange/generate-report-on-payments-and-usage-by-country-and-time-period', async (ctx) => {
  const {
    externalAPI, // undefined, only for assignment purposes
    PaymentsModel, // undefined, imagine it is a mongoose library model
  } = ctx;

  const notifyViaEmail = ctx.query.notify; // if true, notify via email about reported payment
  const selectedCountry = ctx.query.country; // country where payments were completed
  const periodInDays = ctx.query.period; // how many days from today should we include in the report

  const date = new Date();
  date.setDate(date.getDate() + periodInDays || 30);

  const payments = await PaymentsModel.find({ date: { $gte: date } });

  const filteredPayments = [];
  for (const i = 0; i < payments.length; ++i) {
    if (payments[i].country === selectedCountry) {
      filteredPayments.push(payments[i]);
    }
  }

  let paid = [];
  let pending = [];
  let cancelled = [];
  for (const i = 0; i < payments.length; ++i) {
    const {
      id,
      date,
      status, // 'paid', 'cancelled', 'pending'
      productId,
    } = filteredPayments[i];

    if (status === 'paid') {
      paid = paid.concat([{ id, productId: filteredPayments[i].productId }]);
    }

    if (status === 'pending') {
      pending = pending.concat([{ id, productId: filteredPayments[i].productId }]);
    }

    if (status === 'paid') {
      cancelled = cancelled.concat([{ id, productId: filteredPayments[i].productId }]);
    }
  }

  if (notifyViaEmail) {
    for (const i = 0; i < payments.length; ++i) {
      externalAPI.makeRequest(
        '/v1/send/emails',
        {
          baseURL: EMAIL_SERVICE_PROVIDER,
          method: 'post',
          body: {
            emails: [{
              ID: payments[i]._id,
              email: payments[i].email,
              content: payments[i].content,
            }],
          },
        },
        (err, status) => {
          if (status[0].success) {
            payments[i].notified = true;
            payments[i].save();
          }
        },
      );
    }

    await new Promise((res, rej) => {
      setTimeout(res, 20000);
    });

    await externalAPI.makeRequest(
      '/v1/send/emails',
      {
        baseURL: EMAIL_SERVICE_PROVIDER,
        method: 'post',
        body: {
          emails: [{
            email: 'admin@our-exchange.com',
            content: 'All customers were notified',
          }],
        },
      },
    );
  }

  ctx.status = 200;
  ctx.body = {
    reportOnPayments: {
      paid: paid.length,
      pending: pending.length,
      cancelled: cancelled.length,
    },
  };
});


app.use(router.routes());

app.listen(port, () => console.info(`Listening on port ${port}`));
