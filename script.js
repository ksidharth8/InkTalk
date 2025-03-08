// File Upload and Preview
const uploadInput = document.getElementById("upload");
const previewImage = document.getElementById("preview");
const outputText = document.getElementById("output");
const loadingIndicator = document.getElementById("loading");
const progressBar = document.getElementById("progress");
const sentenceText = document.getElementById("sentence-text");

uploadInput.addEventListener("change", (event) => {
	const file = event.target.files[0];
	if (file) {
		const reader = new FileReader();
		reader.onload = (e) => {
			// Update the preview image
			previewImage.src = e.target.result;
			previewImage.classList.remove("hidden");

			// Clear previous text and reset state
			outputText.value = "";
			utterance.text = "";
			synth.cancel();
			sentences = [];
			currentSentenceIndex = -1;
			progressBar.style.width = "0%";
			sentenceText.textContent = "No sentence playing.";
		};
		reader.readAsDataURL(file); // Read the file as a data URL
	} else {
		console.log("No file selected.");
	}
});

// TTS Setup
const synth = window.speechSynthesis;
const utterance = new SpeechSynthesisUtterance();
let isPlaying = false;
let sentences = []; // Stores all sentences
let currentSentenceIndex = -1; // Tracks current sentence (-1 = none)

// Speech Recognition Setup
const SpeechRecognition =
	window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition;
let isListening = false;

function initializeSpeechRecognition() {
	if (!SpeechRecognition) {
		console.log("Speech recognition not supported");
		return;
	}

	recognition = new SpeechRecognition();
	recognition.continuous = true;
	recognition.interimResults = false;
	recognition.lang = "en-US";

	recognition.onresult = (event) => {
		const transcript =
			event.results[event.results.length - 1][0].transcript.toLowerCase();
		handleVoiceCommand(transcript);
	};

	recognition.onerror = (event) => {
		if (event.error !== "no-speech") {
			console.error("Speech recognition error:", event.error);
			updateMicrophoneStatus(`Error: ${event.error}`, "red");
		}
	};

	recognition.onend = () => {
		if (isListening && isPlaying) {
			recognition.start(); // Restart if still needed
		}
	};
}

function handleVoiceCommand(command) {
	console.log("Voice command:", command);

	// Use regex for more accurate matching
	if (command.match(/\b(pause|stop)\b/)) {
		pauseAudiobook();
	} else if (command.match(/\b(resume|continue)\b/)) {
		resumeAudiobook();
	} else if (command.match(/\b(repeat|again)\b/)) {
		repeatPreviousSentence();
	} else if (command.match(/\b(skip|next)\b/)) {
		skipToNextSentence();
	}
}

function startVoiceRecognition() {
	if (!recognition) initializeSpeechRecognition();
	try {
		recognition.start();
		isListening = true;
		updateMicrophoneStatus("Listening...", "green");
	} catch (error) {
		console.log("Speech recognition start error:", error);
	}
}

function stopVoiceRecognition() {
	if (recognition) {
		recognition.stop();
		isListening = false;
		updateMicrophoneStatus("Microphone off", "gray");
	}
}

function updateMicrophoneStatus(text, color) {
	const micStatus = document.getElementById("mic-status");
	if (micStatus) {
		micStatus.textContent = text;
		micStatus.className = `fixed bottom-4 right-4 p-2 rounded-full text-white bg-${color}-500`;
	}
}

// Text processing functions
function splitTextIntoSentences(text) {
	return text.split(/(?<=[.!?])\s+/); // Split after .!? followed by whitespace
}

function speakSentence(index) {
	if (index >= 0 && index < sentences.length) {
		synth.cancel(); // Stop current speech
		utterance.text = sentences[index];
		synth.speak(utterance);
		currentSentenceIndex = index;
		isPlaying = true;
		sentenceText.textContent = sentences[index];
	}
}

// Audio playback events
utterance.onboundary = (event) => {
	const progressPercent = (event.charIndex / utterance.text.length) * 100;
	progressBar.style.width = `${progressPercent}%`;
};

utterance.onend = () => {
	if (currentSentenceIndex < sentences.length - 1) {
		currentSentenceIndex++;
		speakSentence(currentSentenceIndex);
	} else {
		isPlaying = false;
		stopVoiceRecognition(); // Auto-stop when audio completes
	}
};

// Audiobook controls
function startAudiobook(text) {
	stopVoiceRecognition(); // Clear previous session
	sentences = splitTextIntoSentences(text);
	currentSentenceIndex = -1;
	speakSentence(0);
	startVoiceRecognition();
}

function pauseAudiobook() {
	synth.pause();
	isPlaying = false;
	stopVoiceRecognition();
}

function resumeAudiobook() {
	synth.resume();
	isPlaying = true;
	startVoiceRecognition();
}

function repeatPreviousSentence() {
	if (currentSentenceIndex > 0) {
		speakSentence(currentSentenceIndex - 1);
	}
}

function skipToNextSentence() {
	if (currentSentenceIndex < sentences.length - 1) {
		speakSentence(currentSentenceIndex + 1);
	}
}

// OpenCV image processing
async function preprocessImage(imageSrc) {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.src = imageSrc;
		img.onload = () => {
			// Create a canvas to draw the image
			const canvas = document.createElement("canvas");
			canvas.width = img.width;
			canvas.height = img.height;
			const ctx = canvas.getContext("2d");
			ctx.drawImage(img, 0, 0);

			// Convert canvas to OpenCV Mat
			const src = cv.imread(canvas);

			// Convert to grayscale
			const gray = new cv.Mat();
			cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

			// Apply Gaussian blur
			const blurred = new cv.Mat();
			cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);

			// Apply adaptive thresholding
			const thresholded = new cv.Mat();
			cv.adaptiveThreshold(
				blurred,
				thresholded,
				255,
				cv.ADAPTIVE_THRESH_GAUSSIAN_C,
				cv.THRESH_BINARY,
				11,
				2
			);

			// Convert back to data URL
			cv.imshow(canvas, thresholded);
			const processedImageSrc = canvas.toDataURL();

			// Clean up
			src.delete();
			gray.delete();
			blurred.delete();
			thresholded.delete();

			resolve(processedImageSrc);
		};
		img.onerror = (error) => reject(error);
	});
}

// File conversion handler
document.getElementById("convert").addEventListener("click", async () => {
	const file = uploadInput.files[0];
	if (!file) {
		alert("Please upload an image first.");
		return;
	}

	loadingIndicator.classList.remove("hidden");
	outputText.value = "";

	try {
		// Read the uploaded image
		const reader = new FileReader();
		reader.onload = async (e) => {
			const imageSrc = e.target.result;

			// Preprocess the image
			const processedImageSrc = await preprocessImage(imageSrc);

			// Perform OCR on the preprocessed image
			const {
				data: { text },
			} = await Tesseract.recognize(processedImageSrc, "eng");
			outputText.value = text;
			startAudiobook(text); // Start audiobook with the extracted text
		};
		reader.readAsDataURL(file);
	} catch (error) {
		console.error("OCR error:", error);
		outputText.value = "OCR failed. Please try again.";
	} finally {
		loadingIndicator.classList.add("hidden");
	}
});

// Control bindings
document.getElementById("pause").addEventListener("click", pauseAudiobook);
document.getElementById("resume").addEventListener("click", resumeAudiobook);
document
	.getElementById("repeat")
	.addEventListener("click", repeatPreviousSentence);
document.getElementById("skip").addEventListener("click", skipToNextSentence);

// Initial setup
updateMicrophoneStatus("Microphone off", "gray");
