$(document).ready(function () {
    const predictArea = $(".predict-area");
    const btnSubmit = $("#btn_submit");
    const btnClean = $("#btn_clean");

    $.validator.addMethod(
        "extensionFile1",
        function (value, element, params) {
            // Obtener el nombre del archivo sin la extensión
            var fileInput = value.split(".")[1];
            if (fileInput == "atr") {
                return true;
            } else {
                return false;
            }
        },
        "la extension no es la adecuada"
    );

    $.validator.addMethod(
        "extensionFile2",
        function (value, element, params) {
            // Obtener el nombre del archivo sin la extensión
            var fileInput = value.split(".")[1];
            if (fileInput == "hea") {
                return true;
            } else {
                return false;
            }
        },
        "la extension no es la adecuada"
    );

    $.validator.addMethod(
        "extensionFile3",
        function (value, element, params) {
            // Obtener el nombre del archivo sin la extensión
            var fileInput = value.split(".")[1];
            if (fileInput == "dat") {
                return true;
            } else {
                return false;
            }
        },
        "la extension no es la adecuada"
    );

    $("#form_upload_arrhythmia").validate({
        rules: {
            fileInput1: {
                required: true,
                extensionFile1: ["#fileInput1"],
            },
            fileInput2: {
                required: true,
                extensionFile2: ["#fileInput2"],
            },
            fileInput3: {
                required: true,
                extensionFile3: ["#fileInput3"],
            },
        },
        messages: {
            fileInput1: {
                required: "Por favor cargue un registro",
                extensionFile1: "La extensión no es la solicitada, debe ser (.atr)",
            },
            fileInput2: {
                required: "Por favor cargue un registro",
                extensionFile2: "La extensión no es la solicitada, debe ser (.hea)",
            },
            fileInput3: {
                required: "Por favor cargue un registro",
                extensionFile3: "La extensión no es la solicitada, debe ser (.dat)",
            },
        },
        highlight: function (element, errorClass, validClass) {
            $(element)
                .parents(".col-sm-10")
                .addClass("has-error")
                .removeClass("has-success");
        },
        unhighlight: function (element, errorClass, validClass) {
            $(element)
                .parents(".col-sm-10")
                .addClass("has-success")
                .removeClass("has-error");
        },
    });

    $("#form_upload_arrhythmia").submit(function (e) {
        e.preventDefault();

        var formData = new FormData();

        var fileInput1 = $("#fileInput1")[0].files[0];
        var fileInput2 = $("#fileInput2")[0].files[0];
        var fileInput3 = $("#fileInput3")[0].files[0];

        if (
            fileInput1["name"].split(".")[0] != fileInput2["name"].split(".")[0] ||
            fileInput1["name"].split(".")[0] != fileInput3["name"].split(".")[0]
        ) {
            mostarAlertaUpload();
            enableBtnSubmit();
        } else {
            formData.append("file1", fileInput1);
            formData.append("file2", fileInput2);
            formData.append("file3", fileInput3);

            $.ajax({
                url: "http://127.0.0.1:5003",
                type: "POST",
                data: formData,
                contentType: false,
                processData: false,
                success: function (response) {
                    console.log(response.filename);

                    enableBtnSubmit();

                    fetchECGData(response.filename).then(data => plotECG(data));

                    let predictHTML = `
                    <form id="form_predict_arrhythmia" action="#" method="post" novalidate="novalidate">
                        <h3 class="card-title text-center col-lg-12 mt-2 mb-2">Ritmo Cardiaco</h3>

                        <div class="col-lg-12 text-center mb-2">
							<div id="ecg-plot"></div>
                        </div>

                        <div class="col-lg-12 text-end">
                            <button type=" submit" id="btn_submit" class="btn btn-dark"><i
                                    class="fa-solid fa-brain"></i>
                                Predecir</button>
                        </div>
                    </form>
                `;

                    predictArea.html(predictHTML);
                },
            });
        }

        disableBtnSubmit();
    });

    btnClean.on("click", function () {
        predictArea.empty();
        btnSubmit.removeAttr("disabled");
        $("#btn_clean").addClass("d-none");
    });
});

function disableBtnSubmit() {
    $("#btn_submit").attr("disabled", "disabled");
    $("#btn_submit").html(`
        <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
        Cargando...
    `);
}

function enableBtnSubmit() {
    $("#btn_submit").html(`
        <i class="fa-solid fa-upload"></i> Cargar
    `);

    $("#btn_clean").removeClass("d-none");
}

function mostarAlertaUpload() {
    Swal.fire({
        icon: "error",
        title: "Oops...",
        text: "Los archivos cargados deben tener el mismo nombre",
    });
}

async function fetchECGData(filename) {
    const response = await fetch('http://127.0.0.1:5003/ecg/' + filename);
    const data = await response.json();
    return data;
}

function plotECG(data) {
    const trace = {
        y: data.slice(0, 1000),
        type: 'scatter',
        mode: 'lines',
        line: {
            color: '#000',
            width: 1
        }
    };

    const layout = {
        xaxis: {
            title: 'Time (ms)',
            titlefont: {
                size: 16,
                color: '#333'
            },
            range: [0, 1000],
            tickfont: {
                size: 14,
                color: '#333'
            },
            fixedrange: true
        },
        yaxis: {
            title: 'Amplitude (mV)',
            titlefont: {
                size: 16,
                color: '#333'
            },
            tickfont: {
                size: 14,
                color: '#333'
            },
            fixedrange: true
        },
        plot_bgcolor: 'rgba(255, 255, 255, 0.9)',
        paper_bgcolor: '#f4f4f4',
        dragmode: false,
        modeBarButtonsToRemove: ['toImage'],
        modeBarButtonsToAdd: []
    };

    var config = {responsive: true}

    Plotly.newPlot('ecg-plot', [trace], layout, config);

    // Ajustes para una frecuencia cardíaca realista
    const samplingRate = 360; // Suponiendo una frecuencia de muestreo típica de 360 Hz
    const interval = 1000 / samplingRate; // Intervalo de actualización en milisegundos para una frecuencia de muestreo de 360 Hz
    let currentIndex = 1000;

    setInterval(() => {
        if (currentIndex < data.length) {
            const newData = data.slice(currentIndex, currentIndex + 1); // Tomar un solo punto de datos
            const update = {
                y: [[newData[0]]]
            };
            Plotly.extendTraces('ecg-plot', update, [0]);
            currentIndex += 1;

            // Desplazar el rango del eje X para simular el movimiento de la señal ECG
            Plotly.relayout('ecg-plot', {
                'xaxis.range': [currentIndex - 1000, currentIndex]
            });
        }
    }, interval);
}