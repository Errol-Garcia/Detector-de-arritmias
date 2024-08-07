from flask import Flask,request, jsonify
import numpy as np
import pandas as pd
from flask_cors import CORS
import preprocesamiento
import os
import tensorflow as tf
import csv
import wfdb
import json
import io
from funcionesPreprocesamiento import llamado, normalizacion, detectorQRS, Binarizacion, filtro, segmentacion, completar, ajusteDatos


app=Flask(__name__)
CORS(app)

UPLOAD_FOLDER = './files'

# Configurar la carpeta de subida en la aplicación
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

@app.route('/',methods=['POST'])
def index():
    filename = upload_data(request.files['file'])
    filename2 = upload_data(request.files['file2'])
    filename3 = upload_data(request.files['file3'])
    dts, etq =preprocesamiento.inicio(filename)

    return jsonify({"fileName": filename})


def upload_data(file):

    if file.filename == '':
        return 'No selected file', 400
    
    print("prueba de que esta en el backend")
    print("el nombre es",file.filename)
    # Guardar el archivo en la carpeta de subidas
    file_path = os.path.join(app.config['UPLOAD_FOLDER'], file.filename)
    print("ruta: ", file_path)
    file.save(file_path)

    return file.filename.split('.')[0]
    
@app.route('/ecg/<filename>', methods=['GET'])
def get_ecg(filename):
    data = wfdb.rdrecord(f'./files/{filename}')
    
    ecg_data = data.p_signal[:, 0].tolist()
    
    return jsonify(ecg_data)

@app.route('/predict', methods=['POST'])
def fit():
    
    data =  request.get_json()

    file_names = data['fileNames']
    register_name = file_names
    X_new = np.loadtxt(f"./files/datos-{register_name}.dat")
    
    segment_size = 100  # Tamaño de cada segmento
    num_segments = len(X_new) // segment_size
    
    try:
        X_newShape = X_new.reshape((X_new.shape[0], X_new.shape[1], 1))
    except ValueError as e:
        print("Error al reestructurar el array:", e)
        exit(1)

    path="./modelo_CNN1D.h5"
    model= tf.keras.models.load_model(path)
    
    predictions = model.predict(X_newShape)
    
    predicted_classes = np.argmax(predictions, axis=1)
    
    json_data = {
        "datos": X_new.tolist(),
        "etiquetas": np.array(predicted_classes)
    }
    np.savetxt(f'./files/etiquetas-{register_name}.dat',predicted_classes)

    # nombre_archivo = f'./files/etiquetas-{register_name}.csv'

    predicted_classes = [predicted_classes]
    # Abrir el archivo en modo de escritura y escribir los datos
    # with open(nombre_archivo, mode='w', newline='') as file:
    #     writer = csv.writer(file)
    #     writer.writerows(predicted_classes)
    
    etiquetas = np.loadtxt(f'./files/etiquetas-{register_name}.dat').tolist()
    json_data = {
        "datos": X_new.tolist(),
        "etiquetas": etiquetas
    }
    
    record = wfdb.rdrecord(os.path.join(app.config['UPLOAD_FOLDER'], '100'))
    total_samples = record.sig_len
    sampling_frequency = record.fs
    data = record.p_signal.flatten().tolist()
    
    atr_file = os.path.join(app.config['UPLOAD_FOLDER'], '100.atr')
    if os.path.exists(atr_file):
        annotations = wfdb.rdann(os.path.join(app.config['UPLOAD_FOLDER'], '100'), 'atr')
        arrythmia_labels = annotations.aux_note
    else:
        arrythmia_labels = [0] * total_samples  # Placeholder si no hay etiquetas

    arrhythmia_data = etiquetas
    segment_duration_seconds = 10
    segment_size = segment_duration_seconds * sampling_frequency
    num_segments = int(np.ceil(total_samples / segment_size))
    
    data = [elemento for fila in X_new for elemento in fila]
    # Guardar el JSON en un archivo
    # with open('datos.json', 'w') as f:
    #     json.dump(json_data, f)
      
    response = {
        'total_samples': total_samples,
        'sampling_frequency': sampling_frequency,
        'segment_size': segment_size,
        'num_segments': num_segments,
        'data': data,
        'arrhythmia': arrhythmia_data
    }

    return jsonify(response)  
    
        
    # return jsonify({"message": "Archivos recibidos", "data": json_data})


@app.route('/normalizacion',methods=['POST'])
def normalizar():
    filename = upload_data(request.files['file'])
    filename2 = upload_data(request.files['file2'])
    filename3 = upload_data(request.files['file3'])
    
    raw_data, id_events=llamado(filename)
    data_normal=normalizacion(raw_data)
    
    np.savetxt(f'./files/Normalizacion-{filename}.dat',data_normal)
    id_events = np.array([id_events])
    
    np.savetxt(f'./files/Eventos-{filename}.dat', id_events, fmt='%s')
    name = f'Normalizacion-{filename}.dat'
    eventos = f'Eventos-{filename}.dat'
        
    return jsonify({"fileName": name, "fileEvento":eventos}) 


@app.route('/pqrs',methods=['POST'])
def pqrs():
    filename = upload_data(request.files['file'])
    filename2 = upload_data(request.files['file2'])
    filename3 = upload_data(request.files['file3'])
    
    pqrs = detectorQRS(filename)
    
    np.savetxt(f'./files/PQRS-{filename}.dat',pqrs)
    name = f'PQRS-{filename}.dat'
    
    return jsonify({"fileName": name})  

@app.route('/segmentacionMethod',methods=['POST'])
def segmentacionMethod():
    
    datosSeg=[]
    dts=[]
    datosSegmentados=[]
    etiquetas1=[]
    etiquetas2=[]
    
    normalizacion = upload_data(request.files['normalizacion'])
    pqrs = upload_data(request.files['pqrs'])
    eventos = upload_data(request.files['eventos'])
    
    normalizacion = np.loadtxt(f"./files/{normalizacion}.dat")
    id_events = np.loadtxt(f"./files/{eventos}.dat", dtype=str)
    
    pqrs = np.loadtxt(f"./files/{pqrs}.dat")
    pqrs = pqrs.astype(int)
    
    p=segmentacion(normalizacion, pqrs )
    
    datosSeg.append(p)

    for i in range(len(datosSeg)):
        for j in range(len(datosSeg[i])):
            datosSegmentados.append(datosSeg[i][j])

    ll=filtro(datosSegmentados)
    #Binarizacion de las etiquetas
    etiquetas1.append(Binarizacion(id_events))


    for i in range(len(etiquetas1)):
        for j in range(len(etiquetas1[i])):
            etiquetas2.append(etiquetas1[i][j])
            
    etq, dts = completar(etiquetas2, datosSegmentados)

    dtsCom=[]
    etqCom=[]

    #se ubica en una sola lista los datos de todos los regitros, asi mismo con las etiquetas
    for i in range(len(etq)):
        for j in range(len(etq[i])):
            if(etq[i][j]==1):

                dtsCom.append(dts[i][j])
                etqCom.append(1)
            else:

                dtsCom.append(dts[i][j])
                etqCom.append(0)

    #se ajusta los segmentos de datos para que tengan la misma longitud
    dtsCom=ajusteDatos(dtsCom)

    np.savetxt(f'./files/datos.dat',dtsCom)
    
    return jsonify({"fileName": "datos.dat"})  


@app.route('/predictOnly',methods=['POST'])
def predictOnly():

    register_name = upload_data(request.files['file'])
    
    X_new = np.loadtxt(f"./files/{register_name}.dat")
    
    segment_size = 100  # Tamaño de cada segmento
    num_segments = len(X_new) // segment_size
    
    try:
        X_newShape = X_new.reshape((X_new.shape[0], X_new.shape[1], 1))
    except ValueError as e:
        print("Error al reestructurar el array:", e)
        # Manejar el error adecuadamente, tal vez ajustando num_samples o las dimensiones objetivo
        exit(1)

    path="./modelo_CNN1D.h5"
    model= tf.keras.models.load_model(path)
    
    predictions = model.predict(X_newShape)
    
    predicted_classes = np.argmax(predictions, axis=1)
    
    json_data = {
        "datos": X_new.tolist(),
        "etiquetas": np.array(predicted_classes)
    }
    np.savetxt(f'./files/etiquetas.dat',predicted_classes)
    
    predicted_classes = [predicted_classes]
    
    etiquetas = np.loadtxt(f'./files/etiquetas.dat').tolist()
    json_data = {
        "datos": X_new.tolist(),
        "etiquetas": etiquetas
    }
    
    # Guardar el JSON en un archivo
    with open('files/datos.json', 'w') as f:
        json.dump(json_data, f)
        
    return jsonify({"fileName": "etiquetas.dat"})  


if __name__ == '__main__':
    app.run(debug=True, port=5003)
