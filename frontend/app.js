const express = require('express');
const app = express();
const path = require('path');
const router = require('./router/main'); 

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// 정적 파일 제공
app.use('/uploads', express.static(path.join(__dirname, 'router/public/uploads')));
app.use('/edits', express.static(path.join(__dirname, 'router/public/edits')));
app.use(express.static(path.join(__dirname, 'public')));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use('/', router);

const PORT = process.env.PORT || 8000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
});