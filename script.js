

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


    searchTerms = document.getElementById('input-search').value.split(',').map(term => term.trim())
    console.log("search terms: ", searchTerms)
    files = document.getElementById('input-files').files
    const p = document.getElementById('error');

    if (files.length === 0){
        p.innerText =  "kein File ausgewählt"
        return
    } else {
        p.innerText = ""
    }


    //empty list
    entries = new Array();

    let filePromises = Array.from(files).map(processFile);
    Promise.all(filePromises)
        .then(result => {
            // All files have been processed at this point
            console.log("All files processed", result);
            //problem with async: collect all and the make set
            let entriesList = Array.from(new Set(result.flat()));

            console.log("list with entries:", entriesList)
            const totalWeight = entriesList.reduce((result, entry) => result + entry.weight, 0);
            console.log("sum weight: ", totalWeight)

            buildZip(entriesList, totalWeight)
        })
        .catch(error => {
            console.error("An error occurred:", error);
        });
}


async function processFile(file) {
    console.log("file an der reihe: ", file.name)

    let fileName = file.name.replace('.pdf', '');

    let resp = await convertPdfToArrayBuffer(file);
    let clonedArrayBuffer = cloneArrayBuffer(resp);

    // shape into readable object for pdf.js
    let src = { data: resp };

    //extract text and add entries with findings
    let entriesForPdf = await extractText(src, fileName);


    console.log("entries found in pdf :", entriesForPdf);

    for (let i = 0; i < entriesForPdf.length; i++) {
        await extractPageAndAddToEntry(clonedArrayBuffer, entriesForPdf[i], fileName);
    }

    return entriesForPdf;
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
        //empty array for each pdf
        entries = new Array()
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

        return Promise.all(countPromises).then(function () {
            return entries;
        });
    });
}

function buildZip(entries, totalWeight) {
    const priorityA = []
    const priorityB = []
    averageWeight = totalWeight / entries.length
    entries.forEach(entry => {
        if (entry.weight > averageWeight) {
            priorityA.push(entry)
        } else {
            priorityB.push(entry)
        }
    })
    console.log("priorityA: ", priorityA)
    console.log("priorityB: ", priorityB)

    var zip = new JSZip();
    folderA = zip.folder('A')
    folderB = zip.folder('B')
    priorityA.forEach(entry => {
        let fileName = entry.fileName + '_' + entry.page + '.pdf'
        folderA.file(fileName, entry.pdf, { base64: true })
    })
    priorityB.forEach(entry => {
        let fileName = entry.fileName + '_' + entry.page + '.pdf'
        folderB.file(fileName, entry.pdf, { base64: true })
    })
    zip.generateAsync({ type: "blob" })
        .then(function (content) {

            downloadZip(content)
        });
}



async function extractPageAndAddToEntry(pdfAsArrayBuffer, entry) {

    const srcDoc = await PDFLib.PDFDocument.load(pdfAsArrayBuffer);
    const newPdfDoc = await PDFLib.PDFDocument.create();
    const copied = await newPdfDoc.copyPages(srcDoc, [entry.page])
    let p = newPdfDoc.addPage(copied[0])
    let { height, width } = p.getSize();
    p.drawText(entry.terms.join(', '), {
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

    for (let [term, weight] of searchMap) {
        if (text.toLowerCase().includes(term.toLowerCase())) {
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


function downloadZip(zip) {
    const url = window.URL.createObjectURL(zip);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = 'gefunden.zip';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);

    console.log('downlaoded')
}

async function readSettings() {
    try {
        // Use the Fetch API to get the file
        const response = await fetch('settings.txt');

        // Check if the response is ok
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        // Read the text from the file
        const allText = await response.text();
        console.log("Read text from file:", allText);
        return allText.toString();
    } catch (error) {
        console.error("Failed to read the file:", error);
    }
}

async function applySettings() {
    let text = await readSettings()
    text = text.toString()
    searchMap = new Map();
    let params =  text.split('\n').map(entry => entry.trim())
    console.log(params)
    //loop over params¨
    params.forEach(entry =>{
        let [term, weight] = entry.split(',');
        searchMap.set(term, Number(weight))
    })
    console.log("searchmap:", searchMap)
    
    
    buildRangeSlider(searchMap)

}






///old / not needed
async function extractPageAndDownload(pdfAsArrayBuffer, entry, fileName) {

    const srcDoc = await PDFLib.PDFDocument.load(pdfAsArrayBuffer);
    const newPdfDoc = await PDFLib.PDFDocument.create();
    const copied = await newPdfDoc.copyPages(srcDoc, [entry.page])
    let p = newPdfDoc.addPage(copied[0])
    let { height, width } = p.getSize();
    p.drawText(entry.terms.join(', '), {
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

function downloadPdf(entry) {
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


function buildRangeSlider(map){
    text = ""

    for(let [key, value] of map){
        text += `${key} <input type="range" min="1" max="10" value=${value} onInput="updateSlider()"  class="slider" id="${key}"> ${value} <br>`
    }

    const div =  document.getElementById('slider-container')
    console.log("div", div)
    div.innerHTML = text;

}

function updateSlider() {
    buildHashMapFromRangeSliderValues();
    buildRangeSlider(searchMap);
}


function buildHashMapFromRangeSliderValues(){

    //reset map
    searchMap = new Map()

    //get input elements
    const inputs = document.getElementsByClassName('slider');
    //loop over
    Array.from(inputs).forEach(entry => {
        key = entry.id
        value = entry.value
        searchMap.set(key, value)
    })
    console.log("created map from slider: ", searchMap)


}