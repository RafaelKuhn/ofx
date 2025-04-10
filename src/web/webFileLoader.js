import { ReadFile } from "../types.js";


if (typeof document === "undefined") throw new Error("File supposed to run only for the web");

/**
 * @callback FileReadCb
 * @param {ReadFile}
 */

// TODO: pass parameters 
export class InstancedFile {
	constructor(readFile) {
	}
}

const html = {
	dropArea: document.querySelector(".dropArea"),
	listingsUl: document.getElementById("fileList"),
	fileLiTemplate: document.getElementById("liTemplate"),
}

const preventDefault = e => e.preventDefault();
const highlightBorder = () => {
	html.dropArea.classList.add("highlight-border");
	html.dropArea.classList.remove("unhighlight-border");
}

const unHighlightBorder = () => {
	html.dropArea.classList.remove("highlight-border");
	html.dropArea.classList.add("unhighlight-border");
}


/**
 * @param {FileReadCb} onFileRead
 */
export const initHtmlFileReader = onFileRead => {

	const wrapper = document.querySelector(".wrapper");
	const fileInput = document.getElementById("fileInput");

	const evts = [ "dragenter", "dragover", "dragleave", "drop" ];
	evts.forEach(evtName => html.dropArea.addEventListener(evtName, preventDefault));
	evts.forEach(evtName => wrapper.addEventListener(evtName, preventDefault));
	
	[ "dragenter", "dragover" ].forEach(evtName => html.dropArea.addEventListener(evtName, highlightBorder));
	[ "dragleave", "drop"     ].forEach(evtName => html.dropArea.addEventListener(evtName, unHighlightBorder));
	unHighlightBorder();

	wrapper.addEventListener("drop", evt => onDropFile(evt, onFileRead));

	fileInput.addEventListener("change", () => {
		for (const file of fileInput.files) {
			queryFile(file, onFileRead);
		}
	});
}

/** @type {Set.<String>} */
const fileSet = new Set();

/**
 * @param {DragEvent} evt
 * @param {FileReadCb} onFileRead
 */
const onDropFile = (evt, onFileRead) => {
	evt.preventDefault()
	/** @type {DataTransfer} */
	const dt = evt.dataTransfer;
	for (const file of dt.files) {
		queryFile(file, onFileRead);
	}
}

class FileListing {
	/**
	 * @param {String} name
	 * @param {HTMLLIElement} element
	 */
	constructor(name, element) {
		this.name = name;
		this.element = element;
	}
}

/** @type {Array.<FileListing>} */
const fileListings = [];

/**
 * @param {File} file
 * @param {FileReadCb} onFileRead
 */
const queryFile = (file, onFileRead) => {

	const dotInd = file.name.lastIndexOf(".");
	const extension = dotInd === -1 ? "" : file.name.substring(dotInd);
	// console.log(`querying file '${file.name}' extension '${extension}', dotind ${dotInd}`);

	const probablyDirectory = dotInd === -1;
	if (probablyDirectory) return;

	if (extension !== ".ofx") {
		alert(`Wrong file extension: '${extension}'`)
		return;
	}

	const templateCopy = html.fileLiTemplate.cloneNode(true);
	html.listingsUl.appendChild(templateCopy);
	templateCopy.removeAttribute("id");
	templateCopy.querySelector(".name").textContent = file.name
	const percentageSpan = templateCopy.querySelector(".percent");

	const deleteListItem = () => {
		templateCopy.remove();
		reader.abort();
	}

	// TODO: JOIN uncomment remove added file from lists, throw event
	// const closeAnchor = templateCopy.querySelector(".close");
	// closeAnchor.addEventListener("click", deleteListItem);

	const reader = new FileReader();
	reader.addEventListener("error", () => { deleteListItem(); alert(`Error reading '${file.name}': ${reader.error}`); });
	reader.addEventListener("abort", () => { deleteListItem(); alert(`Aborted: '${file.name}'`); });

	const setProgress = progressPercentage => {
		const percentageStr = `${Math.round(progressPercentage * 100).toFixed(0)}%`
		percentageSpan.textContent = percentageStr;
	}

	setProgress(0);
	reader.addEventListener("progress", evt => {
		const progress = evt.loaded / evt.total;
		setProgress(progress);
	});

	reader.addEventListener("load", evt => {
		setProgress(1);
		const fileContent = evt.target.result;
		
		// TODO: extract
		if (fileSet.has(fileContent)) {
			alert(`File '${file.name}' skipped\nIts content was already there`)
			deleteListItem();
			return;
		}

		const listing = new FileListing(file.name, templateCopy);
		fileListings.push(listing);

		percentageSpan.remove();
		fileSet.add(fileContent);

		const removeFromLists = () => {
			fileSet.delete(fileContent);

			const listingIndex = fileListings.findIndex(v => v === listing);
			if (listingIndex === -1) {
				console.error(`wut? -1?`);
				console.error(fileListings);
				return;
			}

			fileListings.splice(listingIndex, 1);
		}

		// TODO: JOIN uncomment remove added file from lists, throw event
		// closeAnchor.addEventListener("click", removeFromLists);

		fileListings.sort((a, b) => {
			if (a.name < b.name) return -1;
			if (a.name > b.name) return  1;
			return 0;
		});

		for (const listingInList of fileListings) {
			html.listingsUl.appendChild(listingInList.element);
		}

		onFileRead(new ReadFile(file.name, fileContent));
	});

	reader.readAsText(file, "UTF-8");
}
