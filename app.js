const express = require('express');
const app = express();
const morgan = require('morgan');
var cors = require('cors');

app.use(cors());

require('dotenv').config();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV === 'production') {
    app.use(morgan('combined'));
} else {
    app.use(morgan('dev'));
}

const indexRouter = require('./routes/index');

app.use('/api', indexRouter);

app.use('/api/ping', (req, res) => {
    res.send('ok');
});

// handle 404 - Not Found
app.use((req, res, next) => {
    const err = new Error('Not Found');
    err.status = 404;
    next(err);
});

// error handler
app.use((err, req, res, next) => {
    const status = err.status || 500;
    res.status(status).json({
        message: err.message,
        ...(process.env.NODE_ENV !== 'production' ? { stack: err.stack } : {})
    });
    if (process.env.NODE_ENV !== 'production') {
        console.error(err)
    }
});

module.exports = app;