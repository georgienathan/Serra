import React from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';

type Props = {
  skills: string;              
  setSkills: (v: string) => void;
  onNext: () => void;
  onBack: () => void;
};

export default function StepAims({ skills, setSkills, onNext, onBack }: Props) {
  return (
    <View style={{ flex: 1, padding: 24, justifyContent: 'center' }}>
      <Text style={{ fontSize: 22, fontWeight: '700', marginBottom: 12, color: '#fff' }}>Do you have any skills you'd like to learn?</Text>

      <TextInput placeholder="e.g., pull-ups, handstand, 5K run (comma separated)"
        value={skills} onChangeText={setSkills}
        style={{ borderWidth:1,borderColor:'#ccc',borderRadius:12,padding:12, marginBottom:18, backgroundColor:'#fff', color:'#111827' }} />

      <View style={{ flexDirection: 'row', justifyContent:'space-between' }}>
        <Pressable onPress={onBack} style={{ backgroundColor: '#e5e7eb', paddingVertical: 12, borderRadius: 12, alignItems: 'center', flex: 1, marginRight: 8 }}>
          <Text style={{ color: '#111827', fontWeight: '700' }}>Back</Text>
        </Pressable>
        <Pressable onPress={onNext} style={{ backgroundColor: '#f2a1b5', paddingVertical: 12, borderRadius: 12, alignItems: 'center', flex: 1, marginLeft: 8 }}>
          <Text style={{ color: 'white', fontWeight: '700' }}>Continue</Text>
        </Pressable>
      </View>
    </View>
  );
}
