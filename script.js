pdfjsLib.GlobalWorkerOptions.workerSrc =
'https://mozilla.github.io/pdf.js/build/pdf.worker.js';

let searchTerms;
let files;



function start() {
    searchTerms = document.getElementById('input-search').value.split(',').map(term => term.trim())
    console.log("search terms: ", searchTerms)
    files = document.getElementById('input-files').files
    console.log('files', files)


    //start function to extract text
    extractText(files[0].url).then(
        function (text) {
            console.log('parse ' + text);
        },
        function (reason) {
            console.error(reason);
        },
        );
        


}

function extractText(pdfUrl) {
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
            page.then(function (page) {
                var textContent = page.getTextContent();
                return textContent.then(function (text) {
                    return text.items
                        .map(function (s) {
                            return s.str;
                        })
                        .join('');
                });
            }),
        );
    }

    return Promise.all(countPromises).then(function (texts) {
        return texts.join('');
    });
});
}



