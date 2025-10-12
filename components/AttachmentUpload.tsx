// components/AttachmentUpload.tsx
import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';
import { palette } from '../lib/tw';
import { AttachmentCategory, AttachmentFileType, uploadAndProcess } from '../src/lib/attachments';

interface AttachmentUploadProps {
  category: AttachmentCategory;
  day: string;
  onUploadStart: () => void;
  onUploadComplete: (attachmentId: string) => void;
  onUploadError: (error: string) => void;
  disabled?: boolean;
}

export default function AttachmentUpload({
  category,
  day,
  onUploadStart,
  onUploadComplete,
  onUploadError,
  disabled = false
}: AttachmentUploadProps) {
  const [uploading, setUploading] = useState(false);

  const requestPermissions = async () => {
    // Request camera permissions
    const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
    const mediaLibraryPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    // Request audio permissions
    const audioPermission = await Audio.requestPermissionsAsync();

    return {
      camera: cameraPermission.status === 'granted',
      mediaLibrary: mediaLibraryPermission.status === 'granted',
      audio: audioPermission.status === 'granted'
    };
  };

  const pickImage = async () => {
    const permissions = await requestPermissions();
    
    if (!permissions.mediaLibrary && !permissions.camera) {
      Alert.alert(
        'Permission Required',
        'Please grant camera and photo library permissions to upload images.'
      );
      return;
    }

    try {
      setUploading(true);
      onUploadStart();

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: false,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const attachment = await uploadAndProcess({
          category,
          day,
          localUri: asset.uri,
          fileType: 'image'
        });

        onUploadComplete(attachment.id);
      }
    } catch (error: any) {
      console.error('Image upload error:', error);
      onUploadError(error.message || 'Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  const takePhoto = async () => {
    const permissions = await requestPermissions();
    
    if (!permissions.camera) {
      Alert.alert(
        'Permission Required',
        'Please grant camera permission to take photos.'
      );
      return;
    }

    try {
      setUploading(true);
      onUploadStart();

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: false,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const attachment = await uploadAndProcess({
          category,
          day,
          localUri: asset.uri,
          fileType: 'image'
        });

        onUploadComplete(attachment.id);
      }
    } catch (error: any) {
      console.error('Photo capture error:', error);
      onUploadError(error.message || 'Failed to capture photo');
    } finally {
      setUploading(false);
    }
  };

  const recordAudio = async () => {
    const permissions = await requestPermissions();
    
    if (!permissions.audio) {
      Alert.alert(
        'Permission Required',
        'Please grant microphone permission to record voice notes.'
      );
      return;
    }

    try {
      setUploading(true);
      onUploadStart();

      // Configure audio recording
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      // Show recording UI - for now, just record for 10 seconds
      // TODO: Add proper recording UI with start/stop controls
      setTimeout(async () => {
        await recording.stopAndUnloadAsync();
        const uri = recording.getURI();
        
        if (uri) {
          const attachment = await uploadAndProcess({
            category,
            day,
            localUri: uri,
            fileType: 'audio'
          });

          onUploadComplete(attachment.id);
        }
      }, 10000); // 10 second recording

    } catch (error: any) {
      console.error('Audio recording error:', error);
      onUploadError(error.message || 'Failed to record audio');
      setUploading(false);
    }
  };

  const showImageOptions = () => {
    Alert.alert(
      'Add Photo',
      'Choose how you want to add a photo',
      [
        { text: 'Camera', onPress: takePhoto },
        { text: 'Photo Library', onPress: pickImage },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Add via Photo or Voice</Text>
      <View style={styles.buttonRow}>
        <Pressable
          style={[styles.button, styles.photoButton, disabled && styles.disabled]}
          onPress={showImageOptions}
          disabled={disabled || uploading}
        >
          <FontAwesome5 name="camera" size={16} color="#fff" />
          <Text style={styles.buttonText}>Photo</Text>
        </Pressable>

        <Pressable
          style={[styles.button, styles.audioButton, disabled && styles.disabled]}
          onPress={recordAudio}
          disabled={disabled || uploading}
        >
          <FontAwesome5 name="microphone" size={16} color="#fff" />
          <Text style={styles.buttonText}>Voice</Text>
        </Pressable>
      </View>
      {uploading && (
        <Text style={styles.uploadingText}>Uploading...</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: palette.text,
    marginBottom: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 8,
  },
  photoButton: {
    backgroundColor: palette.green,
  },
  audioButton: {
    backgroundColor: palette.teal,
  },
  disabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  uploadingText: {
    color: palette.text,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
});
