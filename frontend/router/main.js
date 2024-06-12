const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const AWS = require('aws-sdk');
const router = express.Router();
const dotenv = require('dotenv').config({ path: '../.env' });

const ID = process.env.ID;
const SECRET = process.env.SECRET;
const BUCKET_NAME = process.env.BUCKET_NAME;
const MYREGION = process.env.MYREGION;

if (!ID || !SECRET || !BUCKET_NAME || !MYREGION) {
    console.error('Missing environment variables. Please check your .env file.');
    process.exit(1);
}

// AWS S3 설정
AWS.config.update({
    accessKeyId: ID,
    secretAccessKey: SECRET,
    region: MYREGION
});

const s3 = new AWS.S3();

const upload = multer({ dest: 'uploads/' });

router.get('/', (req, res) => {
    res.render('views');
});

// 파일 업로드를 위한 multer 설정
const storageUploads = multer.diskStorage({
    destination: function (req, file, cb) {
        const dir = path.join(__dirname, 'public/uploads');
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname);
    }
});

const storageEdits = multer.diskStorage({
    destination: function (req, file, cb) {
        const dir = path.join(__dirname, 'public/edits');
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, file.originalname);
    }
});

const uploadToUploads = multer({ storage: storageUploads });
const uploadToEdits = multer({ storage: storageEdits });

router.post('/upload', uploadToUploads.single('file'), (req, res) => {
    if (req.file) {
        const fileContent = fs.readFileSync(req.file.path);
        const params = {
            Bucket: BUCKET_NAME,
            Key: `uploadedVideos/${req.file.originalname}`,
            Body: fileContent
        };
        s3.upload(params, (err, data) => {
            if (err) {
                console.error("Error uploading file: ", err);
                return res.status(500).send('Failed to upload file to S3');
            }
            console.log(`File uploaded successfully to S3. ${data.Location}`);
            // S3에서 파일을 다시 로컬로 다운로드
            const downloadParams = {
                Bucket: BUCKET_NAME,
                Key: `uploadedVideos/${req.file.originalname}`
            };
            const filePath = path.join(__dirname, 'public/uploads', req.file.originalname);
            const file = fs.createWriteStream(filePath);
            s3.getObject(downloadParams)
                .createReadStream()
                .pipe(file)
                .on('close', () => {
                    console.log(`File downloaded to ${filePath}`);
                    res.status(200).send('File uploaded successfully to S3 and server');
                })
                .on('error', (downloadErr) => {
                    console.error("Error downloading file: ", downloadErr);
                    res.status(500).send('Failed to download file from S3');
                });
        });
    } else {
        res.status(400).send('File upload failed');
    }
});

router.post('/edits', uploadToEdits.single('file'), (req, res) => {
    if (req.file) {
        const fileContent = fs.readFileSync(req.file.path);
        const params = {
            Bucket: BUCKET_NAME,
            Key: `editedVideos/${req.file.originalname}`,
            Body: fileContent
        };
        s3.upload(params, (err, data) => {
            if (err) {
                console.error("Error uploading file: ", err);
                return res.status(500).send('Failed to upload file to S3');
            }
            console.log(`File uploaded successfully to S3. ${data.Location}`);
            // S3에서 파일을 다시 로컬로 다운로드
            const downloadParams = {
                Bucket: BUCKET_NAME,
                Key: `editedVideos/${req.file.originalname}`
            };
            const filePath = path.join(__dirname, 'public/edits', req.file.originalname);
            const file = fs.createWriteStream(filePath);
            s3.getObject(downloadParams)
                .createReadStream()
                .pipe(file)
                .on('close', () => {
                    console.log(`File downloaded to ${filePath}`);
                    res.status(200).send('File uploaded successfully to S3 and server');
                })
                .on('error', (downloadErr) => {
                    console.error("Error downloading file: ", downloadErr);
                    res.status(500).send('Failed to download file from S3');
                });
        });
    } else {
        res.status(400).send('File upload failed');
    }
});

router.get('/list', (req, res) => {
    const params = {
        Bucket: BUCKET_NAME,
        Delimiter: '/',
        Prefix: 'uploadedVideos/', 
    };
    s3.listObjects(params, (err, data) => {
        if (err) {
            console.error("Error listing files: ", err);
            return res.status(500).send('Failed to list files from S3');
        }
        const fileList = data.Contents.map(item => ({
            key: item.Key,
            url: `https://${BUCKET_NAME}.s3.${MYREGION}.amazonaws.com/${item.Key}`
        }));
        res.json(fileList);
    });
});

router.get('/formerclips', (req, res) => {
    res.render('formerclips');
});

router.get('/check-file-exists', (req, res) => {
    const { file, type } = req.query;
    let filePath = '';
    
    if (type === 'original') {
        filePath = path.join(__dirname, 'public/uploads', file);
    } else if (type === 'analyzed') {
        filePath = path.join(__dirname, 'public/edits', file);
    }

    fs.access(filePath, fs.constants.F_OK, (err) => {
        if (err) {
            res.json({ exists: false });
        } else {
            res.json({ exists: true });
        }
    });
});

router.get('/check-latest-file', (req, res) => {
    const { type } = req.query;
    const folder = type === 'original' ? 'uploads' : 'edits';
    const dirPath = path.join(__dirname, `public/${folder}`);

    fs.readdir(dirPath, (err, files) => {
        if (err) {
            console.error('Error reading directory: ', err);
            return res.status(500).json({ exists: false, file: null });
        }

        if (files.length === 0) {
            return res.json({ exists: false, file: null });
        }

        // 최신 파일 찾기
        let latestFile = files[0];
        let latestTime = fs.statSync(path.join(dirPath, latestFile)).mtime;

        files.forEach(file => {
            const fileTime = fs.statSync(path.join(dirPath, file)).mtime;
            if (fileTime > latestTime) {
                latestFile = file;
                latestTime = fileTime;
            }
        });

        res.json({ exists: true, file: latestFile });
    });
});

module.exports = router;
