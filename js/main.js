const URL_API = 'http://127.0.0.1:5003/api';

let chart;
let chartData = [];
let currentIndex = 0;
let interval;
let segmentSize;
let samplingFrequency;
let totalSamples;
let numSegments;
let totalTime;
let currentSegment = 1;
let isPlaying = false;
let arrhythmiaData = [];
let countArrhythmia = 0;
let filename;

$(document).ready(function () {
	pageLoad();
	initializeEventListeners();
	initializeFormValidation();
});

function initializeEventListeners() {
	$(".toggle-btn").click(() => $("#sidebar").toggleClass("expand"));
	$("#form_upload_files").submit(handleFileUpload);
}

function initializeFormValidation() {
	$("#form_upload_files").validate({
		rules: {
			heaFile: { required: true },
			datFile: { required: true },
			atrFile: { required: true },
		},
		messages: {
			heaFile: { required: "Por favor cargue un registro" },
			datFile: { required: "Por favor cargue un registro" },
			atrFile: { required: "Por favor cargue un registro" },
		},
		highlight: (element) => $(element).parents(".col-sm-10").toggleClass("has-error has-success"),
		unhighlight: (element) => $(element).parents(".col-sm-10").toggleClass("has-error has-success"),
	});
}

async function handleFileUpload(e) {
	e.preventDefault();

	const formData = new FormData(this);
	if (validateEmptyFiles() === false) return;
	if (validateDifferentFiles() === false) return;
	appendFilesToFormData(formData);

	toggleLoadingState("#btn_upload", true, "Cargando...", null);
	disableButton(".btn", true);
	disableButton(".form-control", true);

	var isDisabled = false;

	try {
		const response = await uploadFiles(formData);
		filename = response.filename;
		const data = await fetchECGData(filename[0]);

		setupChartData(data);
		cloneTemplate();
		initializeChart();
		setupControlButtons();
		showButton("#btn_clean", true);
		$("#form_predict_arrhythmia").submit(handlePrediction);
		isDisabled = true;

		scrollToBottom();
	} catch (error) {
		console.error("Error al subir archivos: ", error);
		isDisabled = false;
	} finally {
		disableButton(".btn", false);
		disableButton(".form-control", isDisabled);
		disableButton("#btn_upload", isDisabled);
		toggleLoadingState("#btn_upload", false, "Cargar", "fa-upload");
	}
}

async function handlePrediction(e) {
	e.preventDefault();

	isPlaying = true;
	togglePlayPause();
	toggleLoadingState("#btn_predict", true, "Prediciendo...", null);
	disableButton(".btn", true);

	var isDisabled = false;

	try {
		const data = await fetchPredictionData(filename[0]);
		chartData = data.data;
		arrhythmiaData = data.arrhythmia;
		countArrhythmia = arrhythmiaData.reduce((acc, num) => acc + num, 0);
		chart = null;

		$(".graph-area").empty();
		cloneTemplate2();
		setupSlider();
		updateChart2();
		setupControlButtons2();
		addTotalArrythmia();
		showButton("#btn_clean", true);
		isDisabled = true;

		scrollToBottom();
	} catch (error) {
		console.error("Error al predecir: ", error);
		isDisabled = false;
	} finally {
		disableButton(".btn", false);
		disableButton("#btn_upload", isDisabled);
		disableButton("#btn_predict", isDisabled);
		toggleLoadingState("#btn_predict", false, "Predecir", "fa-brain");
	}
}

function validateEmptyFiles() {
	heaFile = $("#heaFile")[0].files[0];
	datFile = $("#datFile")[0].files[0];
	atrFile = $("#atrFile")[0].files[0];

	if (!heaFile || !datFile || !atrFile) {
		return false;
	}
}

function validateDifferentFiles() {
	heaFile = $("#heaFile")[0].files[0]["name"].split(".")[0];
	datFile = $("#datFile")[0].files[0]["name"].split(".")[0];
	atrFile = $("#atrFile")[0].files[0]["name"].split(".")[0];

	if (heaFile != datFile || heaFile != atrFile) {
		Swal.fire({
			icon: "error",
			title: "Oops...",
			text: "Los archivos cargados deben tener el mismo nombre",
		});
		return false;
	}
}

function appendFilesToFormData(formData) {
	heaFile = $("#heaFile")[0].files[0];
	datFile = $("#datFile")[0].files[0];
	atrFile = $("#atrFile")[0].files[0];

	formData.append("heaFile", heaFile);
	formData.append("datFile", datFile);
	formData.append("atrFile", atrFile);
}

async function pageLoad() {
	const response = await fetch(`${URL_API}/pageLoad`, {
		method: "GET",
		headers: {
			"Content-Type": "application/json"
		}
	});
}

async function uploadFiles(formData) {
	const response = await fetch(`${URL_API}/upload`, {
		method: "POST",
		body: formData,
	});
	return await response.json();
}

async function fetchECGData(filename) {
	const response = await fetch(`${URL_API}/ecg/${filename}`, {
		method: "GET",
		headers: {
			"Content-Type": "application/json"
		}
	});
	return await response.json();
}

async function fetchPredictionData(filename) {
	const response = await fetch(`${URL_API}/predict/${filename}`, {
		method: "GET",
		headers: {
			"Content-Type": "application/json"
		}
	});
	return await response.json();
}

function setupChartData(data) {
	samplingFrequency = data.sampling_frequency;
	segmentSize = Math.floor(samplingFrequency);
	totalSamples = data.total_samples;
	chartData = data.data;
	numSegments = data.num_segments;
	totalTime = totalSamples / samplingFrequency;
}

function cloneTemplate() {
	var template = $('#template_graph_area').prop('content');
	var clone = $(template).find('#form_predict_arrhythmia').clone();
	$(".graph-area").append(clone);
}

function cloneTemplate2() {
	var template = $('#template_graph_area2').prop('content');
	var clone = $(template).find('#form_graph').clone();
	$(".graph-area").append(clone);
}

function setupControlButtons() {
	$("#btn_backward").on("click", backward);
	$("#btn_play").on("click", togglePlayPause);
	$("#btn_forward").on("click", forward);
	$("#btn_clean").on("click", clean);
}

function setupControlButtons2() {
	$("#btn_backward").on("click", backward2);
	$("#btn_play").on("click", togglePlayPause2);
	$("#btn_forward").on("click", forward2);
	$("#time_slider").on("input", sliderInput);
	$("#progress_bar").on("input", sliderInput);
}

function initializeChart() {
	setTimeout(() => {
		renderChart(chartData.slice(0, 2000));
		updateProgress();
	}, 0);
}

function setupSlider() {
	$('#time_slider').attr('max', 100);
	$('#time_slider').val(0);
	updateProgress2();
}

function renderChart(data) {
	const labels = data.length;
	const chartOptions = {
		fullWidth: true,
		chartPadding: { right: 40 },
		axisX: {
			labelInterpolationFnc: function (value, index) {
				return labels[index];
			}
		}
	};

	chart = new Chartist.Line('.ct-chart', {
		series: [data]
	}, chartOptions);
}

function renderChart2(data, labels, index) {
	const ctx = $('#ecgChart')[0].getContext('2d');
	const segmentData = data.map((y, i) => ({ x: i, y: y }));

	if (labels[0] === 0) {
		$('#title_cardiac_rhythm').html(`
			RITMO CARDIACO <span class="badge text-bg-success">latido ${index+1} normal</span>
		`);
	} else {
		$('#title_cardiac_rhythm').html(`
			RITMO CARDIACO <span class="badge text-bg-danger">latido ${index+1} arritmia</span>
		`);
	}

	if (chart) {
		chart.destroy();
	}

	chart = new Chart(ctx, {
		type: 'line',
		data: {
			datasets: [{
				label: `Segment ${currentIndex + 1}`,
				data: segmentData,
				borderColor: labels[0] === 1 ? 'red' : 'green',
				borderWidth: 2,
				fill: false,
				pointRadius: 0,
			}]
		},
		options: {
			scales: {
				x: {
					type: 'linear',
					position: 'bottom',
					beginAtZero: true,
					ticks: {
						callback: function (value) {
							return `${(value / samplingFrequency).toFixed(2)}s`;
						}
					}
				}
			},
			elements: {
				line: {
					tension: 0
				}
			},
			plugins: {
				legend: {
					display: false
				}
			}
		}
	});
}

function addTotalArrythmia() {
	$('#total_arrhythmia').html(`
		Latidos: <span class="badge text-bg-success">${arrhythmiaData.length+1}</span> Arrirmias: <span class="badge text-bg-danger">${countArrhythmia}</span>
	`);
}

function updateChart() {
	currentIndex += segmentSize;
	if (currentIndex >= chartData.length) {
		clearInterval(interval);
		currentIndex = chartData.length - segmentSize;
	}
	
	renderChart(chartData.slice(currentIndex, currentIndex + 2000));
	updateProgress();
}

function updateChart2() {
	if (chartData.length === 0 || arrhythmiaData.length === 0) {
		console.error('No hay datos para visualizar');
		return;
	}

	const segmentData = chartData[currentIndex];
	const arrythmiaLabel = arrhythmiaData[currentIndex];

	if (!segmentData) {
		console.error('No hay datos de segmento disponibles');
		return;
	}

	renderChart2(segmentData, [arrythmiaLabel], currentIndex);
	updateProgress2();
}

function togglePlayPause() {
	isPlaying = !isPlaying;
	if (isPlaying) {
		interval = setInterval(updateChart, 1000);
		$("#btn_play").html(`<i class="fa-solid fa-pause"></i>`);
	} else {
		clearInterval(interval);
		$("#btn_play").html(`<i class="fa-solid fa-play"></i>`);
	}
}

function togglePlayPause2() {
	isPlaying = !isPlaying;
	if (isPlaying) {
		isPlaying = true;
		clearInterval(interval);
		interval = setInterval(() => {
			currentIndex++;
			if (currentIndex >= chartData.length) {
				currentIndex = chartData.length - 1;
				togglePlayPause2();
			}
			updateChart2();
		}, 1000);
		$("#btn_play").html(`<i class="fa-solid fa-pause"></i>`);
	} else {
		isPlaying = false;
		clearInterval(interval);
		$("#btn_play").html(`<i class="fa-solid fa-play"></i>`);
	}
}

function forward() {
	isPlaying = false;
	clearInterval(interval);
	$("#btn_play").html(`<i class="fa-solid fa-play"></i>`);
	currentIndex += segmentSize;
	if (currentIndex >= chartData.length) {
		currentIndex = chartData.length - segmentSize;
	}
	renderChart(chartData.slice(currentIndex, currentIndex + 2000));
	updateProgress();
}

function forward2() {
	isPlaying = false;
	clearInterval(interval);
	$("#btn_play").html(`<i class="fa-solid fa-play"></i>`);
	currentIndex++;
	if (currentIndex >= chartData.length) {
		currentIndex = chartData.length - 1;
	}
	updateChart2();
}

function backward() {
	isPlaying = false;
	clearInterval(interval);
	$("#btn_play").html(`<i class="fa-solid fa-play"></i>`);
	currentIndex -= segmentSize;
	if (currentIndex < 0) {
		currentIndex = 0;
	}
	renderChart(chartData.slice(currentIndex, currentIndex + 2000));
	updateProgress();
}

function backward2() {
	isPlaying = false;
	clearInterval(interval);
	$("#btn_play").html(`<i class="fa-solid fa-play"></i>`);
	currentIndex--;
	if (currentIndex < 0) {
		currentIndex = 0;
	}
	updateChart2();
}

function sliderInput() {
	$('#time_slider').on('click', function () {
		isPlaying = false;
		clearInterval(interval);
		$("#btn_play").html(`<i class="fa-solid fa-play"></i>`);
		const newProgress = $(this).val();
		currentIndex = Math.floor((newProgress / 100) * (chartData.length - 1));
		updateChart2();
	});
}

function updateProgress() {
	const progress = (currentIndex / totalSamples) * 100;
	$('#progress_bar').css('width', progress + '%');
	$('#progress_bar').attr('aria-valuenow', progress);

	const currentTime = currentIndex / samplingFrequency;
	$("#progress_time").text(`${formatTime(currentTime)}/${formatTime(totalTime)}`);
}

function updateProgress2() {
	const timeSlider = $('#time_slider')
	const progressTime = $('#progress_time');
	const progress = (currentIndex / (chartData.length - 1)) * 100;

	const currentTime = currentIndex * (segmentSize / samplingFrequency);
	progressTime.text(`${formatTime(currentTime)}/${formatTime(totalTime)}`);
	timeSlider.val(progress);

	if (arrhythmiaData.length > 0) {
		currentSegment = Math.floor(currentIndex / segmentSize) + 1;
	}
}

function formatTime(seconds) {
	const minutes = Math.floor(seconds / 60);
	const secs = Math.floor(seconds % 60);
	return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function scrollToBottom() {
	window.location.href = "#title_cardiac_rhythm";
}

function disableButton(selector, isDisabled) {
	const btn = $(selector);
	if (isDisabled) {
		btn.attr("disabled", "disabled");
	} else {
		btn.removeAttr("disabled");
	}
}

function showButton(selector, isDisabled) {
	const btn = $(selector);
	if (isDisabled) {
		btn.removeClass("d-none");
	} else {
		btn.addClass("d-none");
	}
}

function toggleLoadingState(id, isLoading, text, icon) {
	const btn = $(id);
	if (isLoading) {
		btn.html(`<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> ${text}`);
	} else {
		btn.html(`<i class="fa-solid ${icon}"></i> ${text}`);
	}
}

function clean() {
	window.location.reload();	
}

function resetGraph() {
	renderChart(chartData.slice(0, 2000));
	$('#progress_bar').css('width', 0);
	$('#progress_bar').attr('aria-valuenow', 0);
	$("#progress_time").text(`00:00/${formatTime(totalTime)}`);
	currentIndex = 0;
}

function resetForm() {
	togglePlayPause();
	chart;
	chartData = [];
	currentIndex = 0;
	interval;
	segmentSize;
	samplingFrequency;
	totalSamples;
	numSegments;
	totalTime;
	currentSegment = 1;
	arrhythmiaData = [];
}