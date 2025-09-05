document.addEventListener('DOMContentLoaded', () => {
    const audioFileInput = document.getElementById('audioFileInput');
    const uploadButton = document.getElementById('uploadButton');
    const predictedConditionSpan = document.getElementById('predictedCondition');
    const recommendationList = document.getElementById('recommendationList'); // New: get recommendation list
    const loadingDiv = document.getElementById('loading');
    const errorDiv = document.getElementById('error');
    const waveformDiv = document.getElementById('waveform');
    const audioPlayer = document.getElementById('audioPlayer');
    const startRecordButton = document.getElementById('startRecordButton');
    const stopRecordButton = document.getElementById('stopRecordButton');
    const recordedAudioPlayer = document.getElementById('recordedAudioPlayer');
    const downloadRecording = document.getElementById('downloadRecording');

    let wavesurfer = null;

    // Initialize Wavesurfer
    const initWaveSurfer = () => {
        if (wavesurfer) {
            wavesurfer.destroy();
        }
        wavesurfer = WaveSurfer.create({
            container: '#waveform',
            waveColor: '#4F4F4F',
            progressColor: '#28a745',
            cursorColor: '#0a7a2d',
            barWidth: 2,
            height: 100,
            responsive: true,
            hideScrollbar: true,
            backend: 'MediaElement' // Use MediaElement backend for better compatibility
        });
    };

    initWaveSurfer();

    audioFileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            errorDiv.classList.add('hidden');
            predictedConditionSpan.textContent = 'N/A';
            recommendationList.innerHTML = '<li>N/A</li>'; // Clear recommendations
            
            const reader = new FileReader();
            reader.onload = (e) => {
                wavesurfer.load(e.target.result);
                // Set the audio player source for playback
                audioPlayer.src = e.target.result;
                audioPlayer.classList.remove('hidden');
            };
            reader.readAsDataURL(file);
        }
    });

    // Audio Recording Functionality
    let mediaRecorder;
    let audioChunks = [];

    startRecordButton.addEventListener('click', async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];

            mediaRecorder.ondataavailable = (event) => {
                audioChunks.push(event.data);
            };

            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
                const audioUrl = URL.createObjectURL(audioBlob);
                recordedAudioPlayer.src = audioUrl;
                recordedAudioPlayer.classList.remove('hidden');
                downloadRecording.href = audioUrl;
                downloadRecording.classList.remove('hidden');

                // Optionally, automatically load recorded audio into wavesurfer
                wavesurfer.load(audioUrl);
            };

            mediaRecorder.start();
            startRecordButton.disabled = true;
            stopRecordButton.disabled = false;
            console.log('Recording started');
        } catch (err) {
            console.error('Error accessing microphone:', err);
            errorDiv.textContent = 'Could not access microphone. Please ensure it is connected and permissions are granted.';
            errorDiv.classList.remove('hidden');
        }
    });

    stopRecordButton.addEventListener('click', () => {
        if (mediaRecorder && mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
            startRecordButton.disabled = false;
            stopRecordButton.disabled = true;
            console.log('Recording stopped');
        }
    });

    uploadButton.addEventListener('click', async () => {
        const audioFile = audioFileInput.files[0];
        if (!audioFile) {
            errorDiv.textContent = 'Please select an audio file.';
            errorDiv.classList.remove('hidden');
            return;
        }

        loadingDiv.classList.remove('hidden');
        errorDiv.classList.add('hidden');
        predictedConditionSpan.textContent = 'Analyzing...';
        recommendationList.innerHTML = '<li>Analyzing...</li>'; // Clear previous recommendations

        const formData = new FormData();
        formData.append('audio', audioFile);

        try {
            const response = await fetch('/predict', {
                method: 'POST',
                body: formData,
            });

            const result = await response.json();

            if (response.ok) {
                predictedConditionSpan.textContent = result.predicted_condition;
                // Clear previous recommendations
                recommendationList.innerHTML = '';
                // Add new recommendations
                result.recommendation.forEach(rec => {
                    const listItem = document.createElement('li');
                    listItem.textContent = rec;
                    recommendationList.appendChild(listItem);
                });
            } else {
                errorDiv.textContent = result.error || 'An unknown error occurred.';
                errorDiv.classList.remove('hidden');
                predictedConditionSpan.textContent = 'Error';
                recommendationList.innerHTML = '<li>Error fetching recommendations</li>'; // Display error
            }
        } catch (error) {
            console.error('Error during prediction:', error);
            errorDiv.textContent = 'Network error or server unavailable.';
            errorDiv.classList.remove('hidden');
            predictedConditionSpan.textContent = 'Error';
            recommendationList.innerHTML = '<li>Error fetching recommendations</li>'; // Display error
        } finally {
            loadingDiv.classList.add('hidden');
        }
    });
});
