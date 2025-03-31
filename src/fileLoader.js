

// TODO: decent data structure
class _FileContent {
	/**
	 * @param {String} name
	 * @param {String} content
	 */
	constructor(name, content) {
		this.name = name;
		this.content = content;
	}
}


const wrapper = document.querySelector(".wrapper");
const dropArea = document.querySelector(".dropArea");
const fileInput = document.getElementById("fileInput");

const listingsUl = document.getElementById("fileList");
const fileLiTemplate = document.getElementById("liTemplate");

fileInput.addEventListener("change", () => {
	for (const file of fileInput.files) {
		queryFile(file);
	}
})

const preventDefault = e => e.preventDefault();
const highlightBorder = () => {
	dropArea.classList.add("highlight-border");
	dropArea.classList.remove("unhighlight-border");
}

const unHighlightBorder = () => {
	dropArea.classList.remove("highlight-border");
	dropArea.classList.add("unhighlight-border");
}

export const initFileLoader = () => {

	const evts = [ "dragenter", "dragover", "dragleave", "drop" ];
	evts.forEach(evtName => dropArea.addEventListener(evtName, preventDefault));
	evts.forEach(evtName => wrapper.addEventListener(evtName, preventDefault));
	
	[ "dragenter", "dragover" ].forEach(evtName => dropArea.addEventListener(evtName, highlightBorder));
	[ "dragleave", "drop"     ].forEach(evtName => dropArea.addEventListener(evtName, unHighlightBorder));
	unHighlightBorder();

	wrapper.addEventListener("drop", evt => onDrop(evt));
}

/** @type {Set.<String>} */
const fileSet = new Set();

/** @param {DragEvent} evt */
const onDrop = evt => {
	evt.preventDefault()
	/** @type {DataTransfer} */
	const dt = evt.dataTransfer;
	for (const file of dt.files) {
		queryFile(file);
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

/** @param {File} file */
const queryFile = file => {

	const dotInd = file.name.lastIndexOf(".");
	const extension = dotInd === -1 ? "" : file.name.substring(dotInd);
	// console.log(`querying file '${file.name}' extension '${extension}', dotind ${dotInd}`);

	const probablyDirectory = dotInd === -1;
	if (probablyDirectory) return;

	if (extension !== ".ofx") {
		alert(`Wrong file extension: '${extension}'`)
		return;
	}

	const templateCopy = fileLiTemplate.cloneNode(true);
	listingsUl.appendChild(templateCopy);
	templateCopy.removeAttribute("id");
	templateCopy.querySelector(".name").textContent = file.name
	const percentageSpan = templateCopy.querySelector(".percent");

	const deleteListItem = () => {
		templateCopy.remove();
		reader.abort();
	}

	const closeAnchor = templateCopy.querySelector(".close");
	closeAnchor.addEventListener("click", deleteListItem);

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
			console.log(fileListings.length);
			console.log(fileSet.size);
			
		}

		closeAnchor.addEventListener("click", removeFromLists);

		fileListings.sort((a, b) => {
			if (a.name < b.name) return -1;
			if (a.name > b.name) return  1;
			return 0;
		});

		console.log(fileListings);
		console.log(" ");
		for (const listingInList of fileListings) {
			listingsUl.appendChild(listingInList.element);
		}

	});

	reader.readAsText(file, "UTF-8");
}
