pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://mozilla.github.io/pdf.js/build/pdf.worker.js';

let searchTerms;
let files;

let pagesContaininingSearchTerms;


function start() {
    searchTerms = document.getElementById('input-search').value.split(',').map(term => term.trim())
    console.log("search terms: ", searchTerms)
    files = document.getElementById('input-files').files
    console.log('files', files)


    Array.from(files).forEach(async file => {
        pagesContaininingSearchTerms = new Set();
        const fileName = file.name.trim('.pdf')

        await convertPdfToArrayBuffer(file).then(
            async (resp) => {

                let clonedArrayBuffer = cloneArrayBuffer(resp)
                //extractPageAndDownload(resp, 0)

                console.log(resp)
                //shape into readable object
                src = { data: resp };

                //start function to extract text
                extractText(src).then(
                    async function (text) {
                        console.log('parse ' + text);

                        //download pages
                        console.log("Ergebnisse Wortsuche :", pagesContaininingSearchTerms)

                        const pages = Array.from(pagesContaininingSearchTerms)

                        for (let i = 0; i < pages.length; i++) {
                            console.log("loopover and download")
                            await extractPageAndDownload(clonedArrayBuffer, pages[i], fileName)
                        }

                    },
                    function (reason) {
                        console.error(reason);
                    },
                );

            }

        )


    })



}

async function convertPdfToArrayBuffer(file) {
    console.log(" readfile function called")
    return new Promise((resolve, reject) => {
        let reader = new FileReader();
        reader.onload = () => {
            resolve(reader.result);
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}

function extractText(pdfUrl) {
    let pageNr = 0;
    var pdf = pdfjsLib.getDocument(pdfUrl);
    return pdf.promise.then(function (pdf) {
        var totalPageCount = pdf.numPages;
        var countPromises = [];
        for (
            var currentPage = 1;
            currentPage <= totalPageCount;
            currentPage++
        ) {
            var page = pdf.getPage(currentPage);
            countPromises.push(
                page.then(async function (page) {



                    var textContent = page.getTextContent();
                    return textContent.then(function (text) {
                        return text.items
                            .map(function (s) {
                                return s.str;
                            })
                            .join('');
                    }).then(text => {

                        findSearchTermsInPage(text, pageNr, searchTerms);
                        pageNr++;
                        return text;
                    }
                    );
                }),
            );
        }

        return Promise.all(countPromises).then(function (texts) {
            return texts.join('');
        });
    });
}




async function extractPageAndDownload(pdfAsArrayBuffer, page, fileName) {

    const srcDoc = await PDFLib.PDFDocument.load(pdfAsArrayBuffer);
    const newPdfDoc = await PDFLib.PDFDocument.create();
    const copied = await newPdfDoc.copyPages(srcDoc, [page])
    newPdfDoc.addPage(copied[0])

    const pdfBytes = await newPdfDoc.save()

    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = fileName + '_page_' + page + '.pdf';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);

    console.log('downlaoded')

}

function cloneArrayBuffer(buffer) {
    const clone = new Uint8Array(buffer.byteLength);
    clone.set(new Uint8Array(buffer));
    return clone.buffer;
}


function findSearchTermsInPage(text, pageNr, searchTerms) {
    searchTerms.forEach(term => {
        if (text.toLowerCase().includes(term.toLowerCase())) {
            console.log("found: ", term, "on page ", pageNr)
            pagesContaininingSearchTerms.add(pageNr);
        }
    })
}