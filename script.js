

pdfjsLib.GlobalWorkerOptions.workerSrc =
    './pdf.worker.js';


let searchTerms;
let files;
let entries = [];


let searchMap = new Map();

class Entry {
    constructor(page, terms, fileName, weight) {
      this.page = page;
      this.terms = terms;
      this.weight = weight;
      this.fileName = fileName;
      this.pdf;

    }
  }


 function start() {

    //test entries
    searchMap.set("Georg", 10);
    searchMap.set("Anlage", 1)


    searchTerms = document.getElementById('input-search').value.split(',').map(term => term.trim())
    console.log("search terms: ", searchTerms)
    files = document.getElementById('input-files').files
    console.log('files', files)


    //empty list
    entries = new Array();

    let filePromises = Array.from(files).map(processFile);
    Promise.all(filePromises)
    .then(result => {
        // All files have been processed at this point
        console.log("All files processed", result);
        const entriesList = result[result.length-1];
        console.log("list with entries:", entriesList)
        const totalWeight = entriesList.reduce((result, entry) => result + entry.weight, 0);
        console.log("sum weight: ", totalWeight)


        entriesList.forEach(entry => downloadPdf(entry));

    })
    .catch(error => {
        console.error("An error occurred:", error);
    });


}


async function processFile(file) {
    console.log("file an der reihe: ", file.name)
    //empty entries array
    entries = new Array()
    let fileName = file.name.replace('.pdf', '');

    let resp = await convertPdfToArrayBuffer(file);
    let clonedArrayBuffer = cloneArrayBuffer(resp);

    // shape into readable object for pdf.js
    let src = { data: resp };

    //extract text and add entries with findings
    let text = await extractText(src, fileName);

    console.log('parse ' + text);
    console.log("Ergebnisse Suche :", entries);

    for (let i = 0; i < entries.length; i++) {
    
        await extractPageAndAddToEntry(clonedArrayBuffer, entries[i], fileName);
    }

    return entries;
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

function extractText(pdfUrl, fileName) {
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

                        findSearchTermsInPage(text, pageNr, searchMap, fileName);
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




async function extractPageAndAddToEntry(pdfAsArrayBuffer, entry) {

    const srcDoc = await PDFLib.PDFDocument.load(pdfAsArrayBuffer);
    const newPdfDoc = await PDFLib.PDFDocument.create();
    const copied = await newPdfDoc.copyPages(srcDoc, [entry.page])
    let p = newPdfDoc.addPage(copied[0])
    let {height, width} = p.getSize();
    p.drawText(entry.terms.join(', '),  {
        x: 2,
        y: height - 12,
        size: 10,
      })
  

    const pdfBytes = await newPdfDoc.save()

    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    entry.pdf = blob;
    console.log("added pdf to entry", entry)
}

function cloneArrayBuffer(buffer) {
    const clone = new Uint8Array(buffer.byteLength);
    clone.set(new Uint8Array(buffer));
    return clone.buffer;
}


function findSearchTermsInPage(text, pageNr, searchMap, fileName) {
    let termsOnPage = []
    let totalWeight = 0;

    for (let [term, weight] of searchMap){
        if (text.toLowerCase().includes(term.toLowerCase())){
            console.log("eintrag gefunden", term),
            //add to term array
            termsOnPage.push(term);
            //add to total
            totalWeight += weight;
        }
    }

    if (termsOnPage.length > 0) {
        entries.push(new Entry(pageNr, termsOnPage, fileName, totalWeight));
        console.log(" entries array: ", entries)
    }
}


function downloadPdf(entry){
    const url = window.URL.createObjectURL(entry.pdf);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = entry.fileName + '_' + entry.page + '.pdf';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);

    console.log('downlaoded')

}



///old 
async function extractPageAndDownload(pdfAsArrayBuffer, entry, fileName) {

    const srcDoc = await PDFLib.PDFDocument.load(pdfAsArrayBuffer);
    const newPdfDoc = await PDFLib.PDFDocument.create();
    const copied = await newPdfDoc.copyPages(srcDoc, [entry.page])
    let p = newPdfDoc.addPage(copied[0])
    let {height, width} = p.getSize();
    p.drawText(entry.terms.join(', '),  {
        x: 20,
        y: height - 20,
        size: 10,
      })
  

    const pdfBytes = await newPdfDoc.save()

    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = fileName + '_page_' + entry.page + '.pdf';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);

    console.log('downlaoded')

}

