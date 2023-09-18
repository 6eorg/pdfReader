pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://mozilla.github.io/pdf.js/build/pdf.worker.js';

let searchTerms;
let files;

let findings = []


function start() {
    searchTerms = document.getElementById('input-search').value.split(',').map(term => term.trim())
    console.log("search terms: ", searchTerms)
    files = document.getElementById('input-files').files
    console.log('files', files)


    convertPdfToArrayBuffer(files[0]).then(
        async (resp) => {

            let clonedArrayBuffer = cloneArrayBuffer(resp)
            //extractPageAndDownload(resp, 0)

            console.log(resp)
            //shape into readable object
            src = { data: resp };

            //start function to extract text
            extractText(src).then(
                function (text) {
                    console.log('parse ' + text);


                    //download pages
                    console.log("Seiten, auf denen das Wort vorkommt:", findings)

                    extractPageAndDownload(clonedArrayBuffer, 0)




                },
                function (reason) {
                    console.error(reason);
                },
            );

        }

    )




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
                      
                        console.log("text for page: ", pageNr);
                        console.log("text for this page", text)
                        if (text.includes("Georg")){
                            findings.push(pageNr);
                        }
                        

                        pageNr++;
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



function renderPage(page) {
    var scale = 1;
    var viewport = page.getViewport({scale: scale});

    // Prepare canvas using PDF page dimensions
    var canvas = document.getElementById('the-canvas');
    var context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    // Render PDF page into canvas context
    var renderContext = {
      canvasContext: context,
      viewport: viewport
    };
    var renderTask = page.render(renderContext);
    renderTask.promise.then(function () {
      console.log('Page rendered');
    });
  };



  async function extractPageAndDownload(pdfAsArrayBuffer, page){

        
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
            a.download = 'page_1.pdf';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
    
  }

  function cloneArrayBuffer(buffer) {
    const clone = new Uint8Array(buffer.byteLength);
    clone.set(new Uint8Array(buffer));
    return clone.buffer;
}