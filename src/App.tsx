
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Modality, Part, Type } from "@google/genai";

type ImageState = { B64: string; mimeType: string; file: File };

const defaultFilters = { brightness: '100', contrast: '100', grayscale: '0', sepia: '0', invert: '0' };

const filterPresets = [
  { name: 'Normal', key: 'normal', values: defaultFilters },
  { name: 'Noir', key: 'noir', values: { brightness: '100', contrast: '130', grayscale: '100', sepia: '0', invert: '0' } },
  { name: 'Vintage', key: 'vintage', values: { brightness: '110', contrast: '90', grayscale: '0', sepia: '100', invert: '0' } },
  { name: 'Vibrant', key: 'vibrant', values: { brightness: '110', contrast: '110', grayscale: '0', sepia: '20', invert: '0' } },
  { name: 'Invert', key: 'invert', values: { brightness: '100', contrast: '100', grayscale: '0', sepia: '0', invert: '100' } },
];

const PET_GUIDE_SVG = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><style>path,line,circle{stroke:#5d4037;stroke-width:2;fill:none;stroke-linecap:round;stroke-linejoin:round}</style><circle cx="80" cy="30" r="10"/><path d="M70 35c-10 5-20 25-25 35"/><line x1="65" y1="65" x2="60" y2="85"/><line x1="50" y1="70" x2="45" y2="90"/><line x1="85" y1="45" x2="80" y2="65"/><line x1="75" y1="45" x2="70" y2="65"/><path d="M45 70q-15-5-25-10"/></svg>`)}`;
const HUMAN_GUIDE_SVG = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><style>path,line,circle{stroke:#5d4037;stroke-width:2;fill:none;stroke-linecap:round;stroke-linejoin:round}</style><circle cx="50" cy="20" r="10"/><line x1="50" y1="30" x2="50" y2="60"/><line x1="50" y1="40" x2="30" y2="50"/><line x1="50" y1="40" x2="70" y2="50"/><line x1="50" y1="60" x2="35" y2="85"/><line x1="50" y1="60" x2="65" y2="85"/></svg>`)}`;

const RANDOM_POSES = [
  { name: 'Sit', svg: `data:image/svg+xml,${encodeURIComponent(`<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><style>path,circle{stroke:#333;stroke-width:5;fill:none;stroke-linecap:round;stroke-linejoin:round}</style><path d="M60 35c0 15-10 25-20 25s-20 5-20 20v10"/><circle cx="65" cy="25" r="10"/><path d="M20 90h15"/><path d="M65 90h-20"/></svg>`)}` },
  { name: 'Play', svg: `data:image/svg+xml,${encodeURIComponent(`<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><style>path,circle{stroke:#333;stroke-width:5;fill:none;stroke-linecap:round;stroke-linejoin:round}</style><path d="M75 35c-10-5-20 15-30 25s-25 15-30 5"/><circle cx="80" cy="25" r="10"/><path d="M45 60v25"/><path d="M20 65l-5 20"/></svg>`)}` },
  { name: 'Stand', svg: `data:image/svg+xml,${encodeURIComponent(`<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><style>path,circle{stroke:#333;stroke-width:5;fill:none;stroke-linecap:round;stroke-linejoin:round}</style><path d="M25 60h50"/><circle cx="80" cy="45" r="10"/><path d="M30 60v25"/><path d="M70 60v25"/></svg>`)}` },
  { name: 'Lay Down', svg: `data:image/svg+xml,${encodeURIComponent(`<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><style>path,circle{stroke:#333;stroke-width:5;fill:none;stroke-linecap:round;stroke-linejoin:round}</style><path d="M20 75h60"/><circle cx="25" cy="60" r="10"/><path d="M35 75l10 10"/><path d="M75 75l-10 10"/></svg>`)}` }
];


const getCssFilterStringFromValues = (values: typeof defaultFilters): string => {
  const activeFilters = [];
  if (values.brightness !== '100') activeFilters.push(`brightness(${values.brightness}%)`);
  if (values.contrast !== '100') activeFilters.push(`contrast(${values.contrast}%)`);
  if (values.grayscale !== '0') activeFilters.push(`grayscale(${values.grayscale}%)`);
  if (values.sepia !== '0') activeFilters.push(`sepia(${values.sepia}%)`);
  if (values.invert !== '0') activeFilters.push(`invert(${values.invert}%)`);
  return activeFilters.join(' ');
};

const dataURLtoFile = (dataurl: string, filename: string): File => {
    const arr = dataurl.split(',');
    const mimeMatch = arr[0].match(/:(.*?);/);
    if (!mimeMatch) {
        throw new Error("Invalid data URL");
    }
    const mime = mimeMatch[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
};

const App = () => {
  const [prompt, setPrompt] = useState<string>('');
  const [image, setImage] = useState<ImageState | null>(null);
  const [clothingImage, setClothingImage] = useState<ImageState | null>(null);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState<number>(0);
  const [numberOfVariations, setNumberOfVariations] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [promptSuggestions, setPromptSuggestions] = useState<string[]>([]);
  
  // Video Generation State
  const [isVideoLoading, setIsVideoLoading] = useState<boolean>(false);
  const [videoLoadingMessage, setVideoLoadingMessage] = useState<string>('');
  const [generatedVideo, setGeneratedVideo] = useState<string | null>(null);

  // Filter state
  const [filters, setFilters] = useState(defaultFilters);
  const [activeFilterPreset, setActiveFilterPreset] = useState<string>('normal');


  // Camera state
  const [isCameraOpen, setIsCameraOpen] = useState<boolean>(false);
  const [cameraTarget, setCameraTarget] = useState<'main' | 'clothing' | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState<boolean>(false);
  const [hasCamera, setHasCamera] = useState<boolean>(true); // Optimistic default, will be checked


  // Style ideas state
  const [styleCategory, setStyleCategory] = useState<string | null>(null);
  const [styleSubCategories, setStyleSubCategories] = useState<string[]>([]);
  const [selectedStyleSubCategory, setSelectedStyleSubCategory] = useState<string | null>(null);
  const [styleModalStep, setStyleModalStep] = useState<'categories' | 'images'>('categories');
  const [styleResults, setStyleResults] = useState<string[]>([]);
  const [isStyleModalOpen, setIsStyleModalOpen] = useState<boolean>(false);
  const [isStyleLoading, setIsStyleLoading] = useState<boolean>(false);
  const [styleError, setStyleError] = useState<string | null>(null);
  const [isSelectingStyle, setIsSelectingStyle] = useState<boolean>(false);


  // Cropper State
  const [croppingImage, setCroppingImage] = useState<{ src: string; file: File } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [isCroppingActive, setIsCroppingActive] = useState(false);
  const [cropAspectRatio, setCropAspectRatio] = useState<string>('free');

  // Effect State
  const [selectedEffect, setSelectedEffect] = useState<string>('none');

  // Sketch State
  const [poseSketch, setPoseSketch] = useState<string | null>(null);
  const [isSketchModalOpen, setIsSketchModalOpen] = useState<boolean>(false);
  const [sketchGuide, setSketchGuide] = useState<'pet' | 'human' | 'none'>('pet');
  const [isRandomPoseActive, setIsRandomPoseActive] = useState<boolean>(false);
  
  // Gallery State
  const [isGalleryOpen, setIsGalleryOpen] = useState<boolean>(false);
  const [selectedGalleryImageIndex, setSelectedGalleryImageIndex] = useState<number | null>(null);

  // Granular loading states
  const [isCameraLoading, setIsCameraLoading] = useState<'main' | 'clothing' | null>(null);
  const [isUploading, setIsUploading] = useState<'main' | 'clothing' | null>(null);

  // Accordion state
  const [openSections, setOpenSections] = useState({
    petBirthday: false,
    poseSketch: false,
    filters: false,
    birthdayFun: false,
    styleIdeas: false,
    petAccessories: false,
    effects: false,
    artStyles: false,
  });
  
  // State to manage conflicting accessory modes
  const [accessoryMode, setAccessoryMode] = useState<'image' | 'text4' | 'text5' | 'birthday' | null>(null);
  

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const petFileInputRef = React.useRef<HTMLInputElement>(null);
  const clothingFileInputRef = React.useRef<HTMLInputElement>(null);
  const cropImageRef = useRef<HTMLImageElement>(null);
  const cropBoxRef = useRef<HTMLDivElement>(null);
  const cropContainerRef = useRef<HTMLDivElement>(null);
  const sketchCanvasRef = useRef<HTMLCanvasElement>(null);


  const streamRef = useRef<MediaStream | null>(null);
  
  // Ref for sketch interaction state
  const sketchInteraction = useRef({ isDrawing: false });


  // Ref to store crop interaction state to prevent re-renders on mouse move
  const cropperInteraction = useRef<{
    isDragging: boolean;
    isResizing: boolean;
    handle: string;
    startX: number;
    startY: number;
    startLeft: number;
    startTop: number;
    startWidth: number;
    startHeight: number;
  } | null>(null);

  const panInteraction = useRef<{ startX: number; startY: number; startPanX: number; startPanY: number; } | null>(null);

  const artStyles = [
    { name: '🎬 Cinematic', key: 'cinematic', tag: ', cinematic lighting, dramatic mood' },
    { name: '🌸 Anime', key: 'anime', tag: ', in the style of anime, vibrant colors' },
    { name: '📸 Photorealistic', key: 'photorealistic', tag: ', photorealistic, 8k, hyper-detailed' },
    { name: '✨ Fantasy', key: 'fantasy', tag: ', fantasy art, epic, magical' },
  ];
  
  const effects = [
    { key: 'none', name: 'None', tag: '' },
    { key: 'shimmer', name: '✨ Shimmer', tag: ', with the accessory subtly shimmering with an iridescent, magical light' },
    { key: 'glow', name: '💡 Soft Glow', tag: ', with the accessory emitting a soft, ethereal aura of light' },
    { key: 'painted', name: '🎨 Painted', tag: ', with the accessory having a visible, stylized painted texture, like an oil painting on canvas' },
    { key: 'crystal', name: '💎 Crystal', tag: ', transforming the accessory to look as if it were carved from shimmering, translucent crystal' }
  ];

  const aspectRatios = [
    { key: 'free', label: 'Free' },
    { key: '1:1', label: '1:1' },
    { key: '4:3', label: '4:3' },
    { key: '16:9', label: '16:9' },
  ];

  const defaultClothingPrompt = 'Make the uploaded item blend photorealistically with the pet.';
  const birthdayPrompt = 'Add a festive birthday hat on the pet, colorful confetti in the background, and a small birthday cake nearby.';

  // When a clothing/accessory image is uploaded, provide relevant prompt suggestions.
  useEffect(() => {
    if (clothingImage) {
        setPrompt(defaultClothingPrompt);
        setPromptSuggestions([
            `Make the clothing look natural on the pet.`,
            `Adjust the lighting and shadows for the accessory.`,
            `Seamlessly integrate this item onto the pet.`,
        ]);
        setAccessoryMode('image');
    } else if (accessoryMode === 'image') {
        setAccessoryMode(null);
    }
  }, [clothingImage]);

  // Check for camera availability on mount to prevent errors.
  useEffect(() => {
    const checkCamera = async () => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        setHasCamera(false);
        return;
      }
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const hasVideoInput = devices.some(device => device.kind === 'videoinput');
        setHasCamera(hasVideoInput);
      } catch (err) {
        console.error("Could not enumerate devices:", err);
        setHasCamera(false);
      }
    };
    checkCamera();
  }, []);


  const startCrop = (file: File, targetSetter: React.Dispatch<React.SetStateAction<ImageState | null>>) => {
      // All images now bypass the cropper to provide a consistent upload experience.
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = (reader.result as string).split(',')[1];
        targetSetter({ B64: base64String, mimeType: file.type, file: file });
        setError(null);
        setIsUploading(null);
      };
      reader.readAsDataURL(file);
  };


  const handleFileUpload = (file: File, setImageState: React.Dispatch<React.SetStateAction<ImageState | null>>) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please upload a valid image file.');
      return;
    }
    const target = setImageState === setImage ? 'main' : 'clothing';
    setIsUploading(target);
    startCrop(file, setImageState);
  };
  
  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const handlePetFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileUpload(file, setImage);
    }
    // Reset the input value to allow re-uploading the same file.
    event.currentTarget.value = '';
  };

  const handlePetDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file) handleFileUpload(file, setImage);
  };
  
  const handleClothingFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileUpload(file, setClothingImage);
    }
    // Reset the input value to allow re-uploading the same file.
    event.currentTarget.value = '';
  };
  
  const handleClothingDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file) handleFileUpload(file, setClothingImage);
  };

  const handleRemoveImage = (target: 'main' | 'clothing') => {
    if (target === 'main') {
      setImage(null);
      // Also clear dependent features if the main image is removed
      setPoseSketch(null);
    } else if (target === 'clothing') {
      setClothingImage(null);
      if (prompt === defaultClothingPrompt) {
          setPrompt('');
      }
      setPromptSuggestions([]);
    }
  };

  const handleOpenCamera = async (target: 'main' | 'clothing') => {
    setCameraTarget(target);
    setIsCameraLoading(target);
    setIsCameraOpen(true);
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err: any) {
      console.error("Camera access error:", err.name, err.message);
      if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        setCameraError("No camera found. Please make sure a camera is connected and enabled.");
      } else if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setCameraError("Camera access was denied. Please enable camera permissions in your browser settings.");
      } else {
        setCameraError("Could not access the camera. Please check your connection and browser permissions.");
      }
    } finally {
      setIsCameraLoading(null);
    }
  };

  const handleCloseCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    streamRef.current = null;
    setIsCameraOpen(false);
    setCameraError(null);
    setCameraTarget(null);
    setIsCapturing(false);
  };

  const handleCapturePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video && canvas && cameraTarget) {
      setIsCapturing(true);

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      context?.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], `capture-${Date.now()}.png`, { type: "image/png" });
          const targetSetter = cameraTarget === 'main' ? setImage : setClothingImage;
          handleFileUpload(file, targetSetter); // Use handleFileUpload to show loading indicator
        }
        
        // Add a small delay so the user can see the feedback
        setTimeout(() => {
          handleCloseCamera();
        }, 300);

      }, 'image/png');
    }
  };
  
  // --- Birthday Logic ---

  const handleAddBirthdayTheme = () => {
    setPrompt(birthdayPrompt);
    setAccessoryMode('birthday');
    setClothingImage(null); // Clear clothing image to avoid conflict
    setPromptSuggestions([
        "Make the birthday hat blue.",
        "Add a party blower to the pet's mouth.",
        "Make the cake chocolate flavored.",
    ]);
  };
  
  // --- Pose Sketch Logic ---

  const handleOpenSketchModal = () => {
    if (!image) return;
    setIsSketchModalOpen(true);
  };

  const handleCloseSketchModal = () => {
    setIsSketchModalOpen(false);
  };
  
  const getCanvasCoordinates = (event: React.MouseEvent | React.TouchEvent) => {
    const canvas = sketchCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
  
    const rect = canvas.getBoundingClientRect();
    const touch = 'touches' in event ? event.touches[0] : null;

    // Scale mouse/touch coordinates to canvas resolution
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const clientX = touch ? touch.clientX : (event as React.MouseEvent).clientX;
    const clientY = touch ? touch.clientY : (event as React.MouseEvent).clientY;

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  const startDrawing = (event: React.MouseEvent | React.TouchEvent) => {
    if (isRandomPoseActive) return;
    event.preventDefault();
    const canvas = sketchCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;
  
    const { x, y } = getCanvasCoordinates(event);
    ctx.beginPath();
    ctx.moveTo(x, y);
    sketchInteraction.current.isDrawing = true;
  };
  
  const draw = (event: React.MouseEvent | React.TouchEvent) => {
    if (!sketchInteraction.current.isDrawing) return;
    event.preventDefault();
    const canvas = sketchCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;
  
    const { x, y } = getCanvasCoordinates(event);
    ctx.lineTo(x, y);
    ctx.stroke();
  };
  
  const stopDrawing = () => {
    const canvas = sketchCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;
  
    ctx.closePath();
    sketchInteraction.current.isDrawing = false;
  };

  const handleClearCanvas = () => {
    const canvas = sketchCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    setIsRandomPoseActive(false);
  };
  
  const handleRandomPose = () => {
    const canvas = sketchCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    handleClearCanvas();

    const randomPose = RANDOM_POSES[Math.floor(Math.random() * RANDOM_POSES.length)];

    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      setIsRandomPoseActive(true);
    };
    img.src = randomPose.svg;
  };

  const handleConfirmSketch = () => {
    const canvas = sketchCanvasRef.current;
    if (canvas) {
      setPoseSketch(canvas.toDataURL('image/png'));
      handleCloseSketchModal();
    }
  };
  
  const handleRemoveSketch = () => {
    setPoseSketch(null);
  }

  // Effect to initialize canvas context when modal opens
  useEffect(() => {
    if (isSketchModalOpen && sketchCanvasRef.current) {
      const canvas = sketchCanvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
      }
    }
  }, [isSketchModalOpen]);
  
  // --- End Pose Sketch Logic ---

  const handleHairstyleClick = () => {
    const newPromptText = "give the pet a new hairstyle";
    setAccessoryMode('text4');
    setPrompt(prev => {
        const trimmedPrev = prev.trim();
        if (trimmedPrev === '' || trimmedPrev === defaultClothingPrompt) {
            return newPromptText.charAt(0).toUpperCase() + newPromptText.slice(1) + '.';
        }
        const separator = trimmedPrev.endsWith('.') ? '' : '.';
        return `${trimmedPrev}${separator} And ${newPromptText}.`;
    });
    setPromptSuggestions([
        'Give the pet a curly hairstyle',
        'Add a stylish mohawk to the pet',
        'Give the pet long, flowing hair',
        'Add a stylish ponytail',
        'Give the pet a short, spiky haircut',
    ]);
  };

  const handleAccessoryClick = (accessory: string) => {
    const accessoryPrompts: { [key: string]: { prompt: string; suggestions: string[] } } = {
        'bow ties': {
            prompt: 'add a dapper bow tie',
            suggestions: [
                'Put a classic black bow tie on the pet.',
                'Add a fun, colorful polka-dot bow tie.',
                'Give the pet a sophisticated silk bow tie.',
            ]
        },
        'hats': {
            prompt: 'put a stylish hat on the pet',
            suggestions: [
                'Add a cute beanie to the pet\'s head.',
                'Give the pet a fancy top hat.',
                'Put a funny propeller hat on the pet.',
            ]
        },
        'necklaces': {
            prompt: 'add a beautiful necklace',
            suggestions: [
                'Drape a pearl necklace around the pet\'s neck.',
                'Add a cool chain necklace to the pet.',
                'Give the pet a charming collar with a heart pendant.',
            ]
        },
        'wings': {
            prompt: 'give the pet a pair of wings',
            suggestions: [
                'Add majestic angel wings to the pet.',
                'Give the pet colorful butterfly wings.',
                'Add small, cute fairy wings to the pet.',
            ]
        },
    };

    const selection = accessoryPrompts[accessory.toLowerCase()];
    if (selection) {
        setAccessoryMode('text5');
        setPrompt(prev => {
            const trimmedPrev = prev.trim();
            if (trimmedPrev === '' || trimmedPrev === defaultClothingPrompt) {
                const newPrompt = selection.prompt.charAt(0).toUpperCase() + selection.prompt.slice(1) + '.';
                return newPrompt;
            }
            const separator = trimmedPrev.endsWith('.') ? '' : '.';
            return `${trimmedPrev}${separator} And ${selection.prompt}.`;
        });
        setPromptSuggestions(selection.suggestions);
    }
  };

  const handleStyleAppend = (style: { name: string; key: string; tag: string; }) => {
    setPrompt(prev => {
      const trimmedPrev = prev.trim();
      if (trimmedPrev === '') {
        return style.tag.startsWith(', ') ? style.tag.substring(2) : style.tag;
      }
      return `${trimmedPrev}${style.tag}`;
    });

    const styleSuggestions: { [key: string]: string[] } = {
        'cinematic': [`A dramatic movie poster of the pet`, `Pet in a cinematic action scene`, `A still from a noir film featuring the pet`],
        'anime': [`The pet as a shonen anime hero`, `A magical girl anime scene with the pet`, `The pet in a Studio Ghibli-style landscape`],
        'photorealistic': [`An ultra-realistic 8k portrait of the pet`, `A hyper-detailed nature photo of the pet`, `A candid, emotional close-up of the pet`],
        'fantasy': [`The pet as a mythical creature`, `The pet in an enchanted forest`, `The pet as a noble steed for a tiny knight`],
    };
    
    if (styleSuggestions[style.key]) {
        setPromptSuggestions(styleSuggestions[style.key]);
    }
  };

  const handleGenerateStyleIdeasClick = async (category: string) => {
    if (!image) {
      setError("Please upload a main image first to get style ideas.");
      return;
    }
    setError(null);
    setStyleCategory(category);
    setIsStyleModalOpen(true);
    setIsStyleLoading(true);
    setStyleResults([]);
    setStyleSubCategories([]);
    setStyleError(null);
    setStyleModalStep('categories');
    setSelectedStyleSubCategory(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const subject = "pet";
      const generationPrompt = `Provide a list of four distinct, popular, and visually interesting types of ${category} for a ${subject}.
      Your response must be a JSON array of strings. For example, for "hats", your response should look like this:
      ["Cowboy Hat", "Top Hat", "Baseball Cap", "Beanie"]`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: generationPrompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.ARRAY,
                items: {
                    type: Type.STRING
                }
            }
        },
      });

      const categories = JSON.parse(response.text);
      if (Array.isArray(categories) && categories.length > 0) {
        setStyleSubCategories(categories);
      } else {
        setStyleError("Could not generate any style categories. Please try again.");
      }
    } catch (err: any) {
      console.error(err);
      setStyleError(err.message || "Failed to generate style ideas.");
    } finally {
      setIsStyleLoading(false);
    }
  };

  const handleSubCategorySelect = async (subCategory: string) => {
    setIsStyleLoading(true);
    setStyleError(null);
    setStyleResults([]);
    setSelectedStyleSubCategory(subCategory);
    setStyleModalStep('images');

    try {
        const subject = "pet";
        const searchPrompt = `A photorealistic image of a popular version of a "${subCategory}" for a ${subject}, in the style of an Amazon product photo. The item is on a plain white background.`;

        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateImages({
            model: 'imagen-4.0-generate-001',
            prompt: searchPrompt,
            config: {
              numberOfImages: 4,
              outputMimeType: 'image/png',
              aspectRatio: '1:1',
            },
        });

        if (response.generatedImages && response.generatedImages.length > 0) {
            const newImages = response.generatedImages.map(img => `data:image/png;base64,${img.image.imageBytes}`);
            setStyleResults(newImages);
        } else {
            setStyleError("Could not generate any style suggestions. Please try another category.");
        }
    } catch (err: any) {
        console.error(err);
        setStyleError(err.message || "Failed to generate style images.");
    } finally {
      setIsStyleLoading(false);
    }
  };

  const handleGeneratedStyleSelect = async (imageDataUrl: string) => {
    setIsSelectingStyle(true);
    try {
      const res = await fetch(imageDataUrl);
      const blob = await res.blob();
      const file = new File([blob], `style-idea-${Date.now()}.png`, { type: 'image/png' });
      const base64String = imageDataUrl.split(',')[1];
      
      setClothingImage({ B64: base64String, mimeType: file.type, file: file });
      setPrompt(`Put this ${selectedStyleSubCategory?.toLowerCase() || 'item'} on the subject.`);
      handleCloseStyleModal();
    } catch (err) {
      console.error("Error selecting generated style:", err);
      setStyleError("Failed to process the selected style image.");
    } finally {
      setIsSelectingStyle(false);
    }
  };

  const handleCloseStyleModal = () => {
    setIsStyleModalOpen(false);
    setStyleCategory(null);
    setStyleSubCategories([]);
    setSelectedStyleSubCategory(null);
    setStyleResults([]);
    setStyleError(null);
    setStyleModalStep('categories');
  }

  const handleStyleModalBack = () => {
    setStyleModalStep('categories');
    setSelectedStyleSubCategory(null);
    setStyleResults([]);
    setStyleError(null);
  };

  const getCssFilterString = (): string => {
    return getCssFilterStringFromValues(filters);
  };
  
  const handleFilterChange = (filterName: keyof typeof filters, value: string) => {
    setFilters(prev => ({ ...prev, [filterName]: value }));
    setActiveFilterPreset('custom'); // User is making a manual adjustment
  };
  
  const handlePresetFilterClick = (preset: typeof filterPresets[0]) => {
    setFilters(preset.values);
    setActiveFilterPreset(preset.key);
  };

  const handleResetFilters = () => {
    setFilters(defaultFilters);
    setActiveFilterPreset('normal');
  };

  const getFilteredImageB64 = (): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!image?.file) {
        return reject(new Error("No image file available."));
      }

      const cssFilterString = getCssFilterString();
      // If no filters are applied, return original B64
      if (!cssFilterString) {
        return resolve(image.B64);
      }

      const img = new Image();
      img.src = URL.createObjectURL(image.file);
      
      img.onload = () => {
        const canvas = canvasRef.current;
        if (canvas) {
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.filter = cssFilterString;
            ctx.drawImage(img, 0, 0);
            const dataUrl = canvas.toDataURL(image.mimeType);
            const base64String = dataUrl.split(',')[1];
            resolve(base64String);
          } else {
            reject(new Error("Could not get canvas context."));
          }
        } else {
          reject(new Error("Canvas element not found."));
        }
      };

      img.onerror = (err) => {
        console.error("Image loading error for canvas:", err);
        reject(new Error("Failed to load image for filtering."));
      };
    });
  };
  
  // --- Cropper Logic ---
  const handleAspectRatioChange = (key: string) => {
    setCropAspectRatio(key);

    if (key === 'free' || !cropBoxRef.current || !cropContainerRef.current) {
      return;
    }

    const box = cropBoxRef.current;
    const container = cropContainerRef.current;
    const ratioParts = key.split(':');
    const ratio = parseFloat(ratioParts[0]) / parseFloat(ratioParts[1]);

    const containerWidth = container.offsetWidth;
    const containerHeight = container.offsetHeight;

    const currentWidth = box.offsetWidth;
    const centerX = box.offsetLeft + currentWidth / 2;
    const centerY = box.offsetTop + box.offsetHeight / 2;

    let newWidth = currentWidth;
    let newHeight = newWidth / ratio;

    if (newHeight > containerHeight) {
      newHeight = containerHeight;
      newWidth = newHeight * ratio;
    }
    if (newWidth > containerWidth) {
      newWidth = containerWidth;
      newHeight = newWidth / ratio;
    }

    let newLeft = centerX - newWidth / 2;
    let newTop = centerY - newHeight / 2;

    if (newLeft < 0) newLeft = 0;
    if (newTop < 0) newTop = 0;
    if (newLeft + newWidth > containerWidth) newLeft = containerWidth - newWidth;
    if (newTop + newHeight > containerHeight) newTop = containerHeight - newHeight;

    box.style.width = `${newWidth}px`;
    box.style.height = `${newHeight}px`;
    box.style.left = `${newLeft}px`;
    box.style.top = `${newTop}px`;
  };

  const handleZoomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newZoom = parseFloat(e.target.value);
    setZoom(newZoom);
    // Reset pan if zooming out to 1 to re-center
    if (newZoom === 1) {
        setPan({ x: 0, y: 0 });
    }
  };

  const handleImagePanMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (zoom <= 1) return;
    e.preventDefault();
    setIsPanning(true);
    panInteraction.current = {
      startX: e.clientX,
      startY: e.clientY,
      startPanX: pan.x,
      startPanY: pan.y,
    };
    window.addEventListener('mousemove', handleImagePanMouseMove);
    window.addEventListener('mouseup', handleImagePanMouseUp);
  };
  
  const handleImagePanMouseMove = (e: MouseEvent) => {
    if (!panInteraction.current || !cropImageRef.current || !cropContainerRef.current || !cropBoxRef.current) return;
    
    const dx = e.clientX - panInteraction.current.startX;
    const dy = e.clientY - panInteraction.current.startY;
    let newPanX = panInteraction.current.startPanX + dx;
    let newPanY = panInteraction.current.startPanY + dy;
  
    // Constrain pan
    const image = cropImageRef.current;
    const container = cropContainerRef.current;
    const box = cropBoxRef.current;

    const imgDisplayWidth = image.width * zoom;
    const imgDisplayHeight = image.height * zoom;

    const imgLeft = (container.offsetWidth - imgDisplayWidth) / 2;
    const imgTop = (container.offsetHeight - imgDisplayHeight) / 2;
  
    const maxPanX = box.offsetLeft - imgLeft;
    const minPanX = (box.offsetLeft + box.offsetWidth) - (imgLeft + imgDisplayWidth);
    
    const maxPanY = box.offsetTop - imgTop;
    const minPanY = (box.offsetTop + box.offsetHeight) - (imgTop + imgDisplayHeight);
  
    newPanX = Math.max(minPanX, Math.min(maxPanX, newPanX));
    newPanY = Math.max(minPanY, Math.min(maxPanY, newPanY));
  
    setPan({ x: newPanX, y: newPanY });
  };
  
  const handleImagePanMouseUp = () => {
    setIsPanning(false);
    panInteraction.current = null;
    window.removeEventListener('mousemove', handleImagePanMouseMove);
    window.removeEventListener('mouseup', handleImagePanMouseUp);
  };
  
  const handleCancelCrop = () => {
    setCroppingImage(null);
  };
  
  const handleConfirmCrop = () => {
    if (!cropImageRef.current || !cropBoxRef.current || !canvasRef.current || !croppingImage || !cropContainerRef.current) {
        console.error("Cropping failed: a required reference or state is missing.");
        return;
    }

    const image = cropImageRef.current;
    const box = cropBoxRef.current;
    const container = cropContainerRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Dimensions of the original image
    const naturalW = image.naturalWidth;
    const naturalH = image.naturalHeight;

    // Dimensions of the image as displayed inside the container (before zoom)
    const displayedW = image.width;
    const displayedH = image.height;

    // How much the displayed image is scaled down from the original
    const scaleToFit = displayedW / naturalW;

    // Position of the crop box relative to the container
    const boxLeft = box.offsetLeft;
    const boxTop = box.offsetTop;
    const boxWidth = box.offsetWidth;
    const boxHeight = box.offsetHeight;

    // Position of the top-left corner of the *zoomed and panned* image relative to the container
    const zoomedImgLeft = (container.offsetWidth - displayedW * zoom) / 2 + pan.x;
    const zoomedImgTop = (container.offsetHeight - displayedH * zoom) / 2 + pan.y;

    // Position of the crop box relative to the top-left of the *zoomed* image
    const relativeX = boxLeft - zoomedImgLeft;
    const relativeY = boxTop - zoomedImgTop;

    // Convert these coordinates from screen pixels back to original image pixels
    const sourceX = relativeX / (scaleToFit * zoom);
    const sourceY = relativeY / (scaleToFit * zoom);
    const sourceWidth = boxWidth / (scaleToFit * zoom);
    const sourceHeight = boxHeight / (scaleToFit * zoom);
    
    // Set canvas to the size of the cropped area on the original image
    canvas.width = sourceWidth;
    canvas.height = sourceHeight;

    // Draw the calculated portion of the original image onto the canvas
    ctx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, sourceWidth, sourceHeight);

    canvas.toBlob((blob) => {
        if (blob) {
            const newFile = new File([blob], croppingImage.file.name, { type: blob.type });
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64String = (reader.result as string).split(',')[1];
                setImage({ B64: base64String, mimeType: newFile.type, file: newFile });
                setError(null);
                setCroppingImage(null);
            };
            reader.readAsDataURL(newFile);
        }
    }, croppingImage.file.type);
  };

  const handleWindowMouseMove = (e: MouseEvent) => {
    if (!cropperInteraction.current || !cropBoxRef.current) return;
    e.preventDefault();

    const { startX, startY, startLeft, startTop, startWidth, startHeight, handle } = cropperInteraction.current;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    let newLeft = startLeft;
    let newTop = startTop;
    let newWidth = startWidth;
    let newHeight = startHeight;
    
    const parent = cropBoxRef.current.parentElement as HTMLElement;
    const parentWidth = parent.offsetWidth;
    const parentHeight = parent.offsetHeight;
    
    if (cropperInteraction.current.isDragging) {
      newLeft += dx;
      newTop += dy;
    } else if (cropperInteraction.current.isResizing) {
       if (handle.includes('e')) newWidth += dx;
       if (handle.includes('s')) newHeight += dy;
       if (handle.includes('w')) { newWidth -= dx; newLeft += dx; }
       if (handle.includes('n')) { newHeight -= dy; newTop += dy; }
    }

    if (cropperInteraction.current.isResizing && cropAspectRatio !== 'free') {
        const ratioParts = cropAspectRatio.split(':');
        const ratio = parseFloat(ratioParts[0]) / parseFloat(ratioParts[1]);

        if (handle === 'e' || handle === 'w') {
            newHeight = newWidth / ratio;
            newTop = startTop + (startHeight - newHeight) / 2;
        } else if (handle === 'n' || handle === 's') {
            newWidth = newHeight * ratio;
            newLeft = startLeft + (startWidth - newWidth) / 2;
        } else { // Corner handles
            const tempNewWidth = handle.includes('w') ? startWidth - dx : startWidth + dx;
            const tempNewHeight = handle.includes('n') ? startHeight - dy : startHeight + dy;

            if ((tempNewWidth / tempNewHeight) > ratio) {
                newHeight = tempNewHeight;
                newWidth = newHeight * ratio;
            } else {
                newWidth = tempNewWidth;
                newHeight = newWidth / ratio;
            }

            if (handle.includes('w')) {
                newLeft = startLeft + (startWidth - newWidth);
            }
            if (handle.includes('n')) {
                newTop = startTop + (startHeight - newHeight);
            }
        }
    }

    // Boundary checks
    if (newLeft < 0) { newWidth += newLeft; newLeft = 0; }
    if (newTop < 0) { newHeight += newTop; newTop = 0; }
    if (newLeft + newWidth > parentWidth) { newWidth = parentWidth - newLeft; }
    if (newTop + newHeight > parentHeight) { newHeight = parentHeight - newHeight; }

    // Minimum size
    if (newWidth < 20) newWidth = 20;
    if (newHeight < 20) newHeight = 20;

    cropBoxRef.current.style.left = `${newLeft}px`;
    cropBoxRef.current.style.top = `${newTop}px`;
    cropBoxRef.current.style.width = `${newWidth}px`;
    cropBoxRef.current.style.height = `${newHeight}px`;
  };

  const handleWindowMouseUp = (e: MouseEvent) => {
    e.preventDefault();
    setIsCroppingActive(false);
    cropperInteraction.current = null;
    window.removeEventListener('mousemove', handleWindowMouseMove);
    window.removeEventListener('mouseup', handleWindowMouseUp);
  };
  
  const handleCropMouseDown = (e: React.MouseEvent<HTMLDivElement>, handle = 'move') => {
    e.preventDefault();
    e.stopPropagation();

    if (!cropBoxRef.current) return;
    
    setIsCroppingActive(true);
    const box = cropBoxRef.current;
    cropperInteraction.current = {
      isDragging: handle === 'move',
      isResizing: handle !== 'move',
      handle: handle,
      startX: e.clientX,
      startY: e.clientY,
      startLeft: box.offsetLeft,
      startTop: box.offsetTop,
      startWidth: box.offsetWidth,
      startHeight: box.offsetHeight,
    };
    
    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);
  };
  // --- End Cropper Logic ---

  const handleClearPrompt = () => {
    setPrompt('');
    setPromptSuggestions([]);
    setAccessoryMode(null);
  };

  const handleGenerateClick = async () => {
    if (!prompt || !image) {
      setError("Please provide a main image and a prompt.");
      return;
    }

    setLoading(true);
    setError(null);
    setGeneratedVideo(null);
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const newImages: string[] = [];
      let failedCount = 0;
      const delay = (ms: number) => new Promise(res => setTimeout(res, ms));
      
      const mainImageB64 = await getFilteredImageB64();

      for (let i = 0; i < numberOfVariations; i++) {
        try {
          const parts: Part[] = [];

          // Add main image
          parts.push({
            inlineData: { data: mainImageB64, mimeType: image.mimeType },
          });

          // Add clothing image if it exists. Placing it before the sketch may help the model.
          if (clothingImage) {
            parts.push({
                inlineData: { data: clothingImage.B64, mimeType: clothingImage.mimeType },
            });
          }

          // Add pose sketch image if it exists
          if (poseSketch) {
            parts.push({
              inlineData: { data: poseSketch.split(',')[1], mimeType: 'image/png' },
            });
          }
          
          let finalPrompt = prompt;
          
          // Add detailed instructions if a clothing image is provided to improve realism.
          if (clothingImage) {
            const clothingInstruction = `\n\n**CRITICAL INSTRUCTIONS FOR REALISM:**\n*   **Fit & Draping:** The clothing must wrap around the pet's body naturally, following its contours and fur. Blend the edges seamlessly to avoid a 'pasted-on' look.\n*   **Lighting & Shadows:** The lighting on the clothing MUST perfectly match the main photo. Cast soft, realistic shadows from the clothing onto the pet.\n*   **Texture & Material:** The clothing's texture must be highly realistic and match the photo's lighting. If the pet's fur is fluffy, the clothing should appear textured, not perfectly smooth, to integrate naturally.\n*   **Scale & Proportion:** The clothing must be sized appropriately for the pet, as if it were made for them.`;
            finalPrompt += clothingInstruction;
          }

          if (poseSketch) {
            // Replaced the old wall of text with a more direct, structured instruction.
            let poseInstruction = `\n\n**CRITICAL INSTRUCTIONS FOR POSE:**\nA line-art sketch has been provided to define the pet's final pose. You MUST use this sketch as a strict reference for the pose. Recreate the pet from the main photo in the exact pose shown in the sketch, prioritizing accuracy in limb placement and body orientation. The final image must be highly photorealistic and anatomically correct. Avoid creating any unnatural or distorted limbs.`;
            if (clothingImage) {
              poseInstruction += ` The pet should be wearing the provided clothing/accessory in this new pose.`;
            }
            finalPrompt += poseInstruction;
          }

          if (selectedEffect !== 'none') {
            const effect = effects.find(e => e.key === selectedEffect);
            if (effect) {
                finalPrompt += effect.tag;
            }
          }

          const variedPrompt = `${finalPrompt} (style variation ${i + 1})`;
          parts.push({ text: variedPrompt });

          const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image-preview',
            contents: { parts },
            config: {
                responseModalities: [Modality.IMAGE, Modality.TEXT],
            },
          });

          let imageFound = false;
          if (response.candidates && response.candidates.length > 0 && response.candidates[0].content && response.candidates[0].content.parts) {
              for (const part of response.candidates[0].content.parts) {
                  if (part.inlineData) {
                      const base64ImageData = part.inlineData.data;
                      const mimeType = part.inlineData.mimeType;
                      newImages.push(`data:${mimeType};base64,${base64ImageData}`);
                      imageFound = true;
                      break; 
                  }
              }
          }
          
          if (!imageFound) {
             console.warn(`Variation ${i + 1} did not return an image. Response:`, response);
             failedCount++;
          }
        } catch (err: any) {
            console.error(`Error generating variation ${i + 1}:`, err);
            failedCount++;
            // Check for rate limit error and break the loop if found
            if (err.message && (err.message.includes('429') || err.message.includes('RESOURCE_EXHAUSTED'))) {
                setError("Rate limit reached. Please wait a moment or try generating fewer variations.");
                break; // Stop trying to generate more images
            }
        }
        
        // Add a longer delay between requests to avoid overwhelming the backend
        if (i < numberOfVariations - 1) {
          await delay(2000);
        }
      }

      if (newImages.length > 0) {
        const oldImageCount = generatedImages.length;
        setGeneratedImages(prev => [...prev, ...newImages]);
        setCurrentImageIndex(oldImageCount);
        if (failedCount > 0 && !error) { // Don't override the rate limit error
          setError(`Successfully generated ${newImages.length} of ${numberOfVariations} variations. Some requests failed.`);
        }
      } else if (!error) { // Don't override an existing error
        setError("Image generation failed. No images were returned from the model.");
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An unexpected error occurred during setup.");
    } finally {
      setLoading(false);
    }
  };

  const videoLoadingMessages = [
    "Warming up the director's chair...",
    "Teaching your pet its lines...",
    "Setting up the lighting...",
    "Rolling camera... Action!",
    "Reviewing the daily rushes...",
    "Adding special effects...",
    "Finalizing the cut...",
    "Preparing the premiere!"
  ];
  
  const getInputImageForVideo = async (): Promise<{ b64: string, mime: string }> => {
    // If a generated image is selected, use it for the video
    if (generatedImages.length > 0 && generatedImages[currentImageIndex]) {
        const dataUrl = generatedImages[currentImageIndex];
        const mime = dataUrl.substring(dataUrl.indexOf(":") + 1, dataUrl.indexOf(";"));
        const b64 = dataUrl.split(',')[1];
        return { b64, mime };
    }
    // Otherwise, use the original (filtered) uploaded image
    const b64 = await getFilteredImageB64();
    return { b64, mime: image!.mimeType };
  };

  const handleGenerateVideoClick = async () => {
    if (!image || generatedImages.length === 0) {
      setError("Please generate an image with a new look before creating a video.");
      return;
    }
  
    setIsVideoLoading(true);
    setError(null);
    setGeneratedImages([]); // Clear previous images
    setGeneratedVideo(null);
  
    let messageInterval: number;
  
    try {
      setVideoLoadingMessage(videoLoadingMessages[0]);
      messageInterval = window.setInterval(() => {
        setVideoLoadingMessage(prev => {
          const currentIndex = videoLoadingMessages.indexOf(prev);
          const nextIndex = (currentIndex + 1) % videoLoadingMessages.length;
          return videoLoadingMessages[nextIndex];
        });
      }, 5000);
  
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const videoPrompt = "A short, high-quality, looping video of the subject in the photo. The subject should show subtle, natural motion, such as blinking, breathing, or slight head movement. The background should remain static.";
      const inputImageData = await getInputImageForVideo();
      
      let operation = await ai.models.generateVideos({
        model: 'veo-2.0-generate-001',
        prompt: videoPrompt,
        image: {
          imageBytes: inputImageData.b64,
          mimeType: inputImageData.mime,
        },
        config: {
          numberOfVideos: 1
        }
      });
  
      while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 10000));
        operation = await ai.operations.getVideosOperation({ operation: operation });
      }
  
      const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
      if (downloadLink) {
        const response = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
        if (!response.ok) {
          throw new Error(`Failed to download video: ${response.statusText}`);
        }
        const videoBlob = await response.blob();
        const videoUrl = URL.createObjectURL(videoBlob);
        setGeneratedVideo(videoUrl);
      } else {
        throw new Error("Video generation completed, but no download link was provided.");
      }
  
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An unexpected error occurred during video generation.");
    } finally {
      clearInterval(messageInterval);
      setIsVideoLoading(false);
    }
  };


  const handleCarouselNav = (direction: 'prev' | 'next') => {
    if (generatedImages.length < 2) return;
    setCurrentImageIndex(prevIndex => {
        const newIndex = direction === 'prev' ? prevIndex - 1 : prevIndex + 1;
        // Modulo arithmetic for wrapping around
        return (newIndex + generatedImages.length) % generatedImages.length;
    });
  };

  const handleDownloadImage = () => {
    if (generatedImages.length === 0) return;
    const imageToDownload = generatedImages[currentImageIndex];
    if (!imageToDownload) return;
    
    const link = document.createElement('a');
    link.href = imageToDownload;
    link.download = `virtual-try-on-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // --- Gallery Logic ---
  const handleOpenGallery = () => {
    if (generatedImages.length > 0) {
        setSelectedGalleryImageIndex(currentImageIndex);
    } else {
        setSelectedGalleryImageIndex(null);
    }
    setIsGalleryOpen(true);
  };

  const handleCloseGallery = () => {
      setIsGalleryOpen(false);
  };

  const handleUseAsMainImage = () => {
      if (selectedGalleryImageIndex === null) return;

      const imageDataUrl = generatedImages[selectedGalleryImageIndex];
      const newFile = dataURLtoFile(imageDataUrl, `gallery-image-${Date.now()}.png`);
      const base64String = imageDataUrl.split(',')[1];
      
      setImage({ B64: base64String, mimeType: newFile.type, file: newFile });
      handleCloseGallery();
  };

  const handleDeleteImage = () => {
      if (selectedGalleryImageIndex === null) return;
      
      if (window.confirm("Are you sure you want to delete this image? This action cannot be undone.")) {
          const indexToDelete = selectedGalleryImageIndex;
          
          const newImages = generatedImages.filter((_, i) => i !== indexToDelete);
          setGeneratedImages(newImages);

          // Adjust currentImageIndex if needed
          if (indexToDelete < currentImageIndex) {
              setCurrentImageIndex(prev => prev - 1);
          } else if (indexToDelete === currentImageIndex) {
              setCurrentImageIndex(prev => Math.max(0, newImages.length > 0 ? prev - 1 : 0));
          }
          
          // Adjust selectedGalleryImageIndex
          if (newImages.length === 0) {
              setSelectedGalleryImageIndex(null);
          } else {
              setSelectedGalleryImageIndex(prev => {
                  if (prev === null) return null;
                  return Math.max(0, prev - 1); // Select the previous image
              });
          }
      }
  };

  const handleDownloadGalleryImage = () => {
      if (selectedGalleryImageIndex === null) return;
      const imageToDownload = generatedImages[selectedGalleryImageIndex];
      if (!imageToDownload) return;

      const link = document.createElement('a');
      link.href = imageToDownload;
      link.download = `virtual-try-on-gallery-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };
  // --- End Gallery Logic ---
  
  const isClothingUploadDisabled = accessoryMode === 'text4' || accessoryMode === 'text5' || accessoryMode === 'birthday';
  const areStyleIdeasDisabled = !!accessoryMode;
  const arePetAccessoriesDisabled = accessoryMode === 'image' || accessoryMode === 'text4' || accessoryMode === 'birthday';

  return (
    <>
      <main className="app-container" aria-label="Virtual Try-On Editor">
        <section className="controls-panel">
          <div className="header">
            <h1>Nano Banana Pet Studio 🍌</h1>
            <p>Give your favorite friend a fun new look!</p>
          </div>
          
          <div className="control-group">
            <label htmlFor="pet-file-upload">1. Upload Main Photo</label>
            <div 
              className={`file-input-area ${image ? 'has-image' : ''}`}
              onClick={() => petFileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDrop={handlePetDrop}
              role="button"
              tabIndex={0}
              aria-label="Main image upload area"
            >
              {isUploading === 'main' && <div className="loading-overlay"><div className="loader small"></div></div>}
              <input
                id="pet-file-upload"
                type="file"
                accept="image/*"
                onChange={handlePetFileChange}
                ref={petFileInputRef}
                style={{ display: 'none' }}
                aria-hidden="true"
              />
              {image ? (
                <div className="image-preview-container">
                  <img src={URL.createObjectURL(image.file)} alt="Uploaded pet photo" className="image-preview" style={{ filter: getCssFilterString() }} />
                  <button 
                    className="remove-image-btn" 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveImage('main');
                    }}
                    aria-label="Remove main image"
                  >
                    &times;
                  </button>
                </div>
              ) : (
                <div className="file-input-placeholder">
                  <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="upload-icon"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
                  <p><strong>Click or drag &amp; drop</strong> an image</p>
                  <span className="file-input-or-divider">or</span>
                  <button
                    className="camera-btn"
                    onClick={(e) => { e.stopPropagation(); handleOpenCamera('main'); }}
                    disabled={isCameraLoading === 'main' || !hasCamera}
                    title={!hasCamera ? "No camera was detected on your device." : "Use your device's camera"}
                  >
                    {isCameraLoading === 'main' ? 'Starting...' : !hasCamera ? 'No Camera' : 'Use Camera'}
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className={`control-group accordion ${openSections.poseSketch ? 'open' : ''} ${!image ? 'disabled-section' : ''}`}>
            <div
              className="accordion-header"
              role="button"
              tabIndex={!image ? -1 : 0}
              onClick={() => image && toggleSection('poseSketch')}
              onKeyDown={(e) => image && (e.key === 'Enter' || e.key === ' ') && toggleSection('poseSketch')}
              aria-expanded={openSections.poseSketch}
              aria-controls="pose-sketch-content"
            >
              <label>2. Draw a Pose (Optional)</label>
              <span className="accordion-icon" aria-hidden="true">+</span>
            </div>
            <div className="accordion-content" id="pose-sketch-content">
              <div className="pose-sketch-content">
                {poseSketch ? (
                  <div className="sketch-preview-container">
                    <img src={poseSketch} alt="Pose sketch" className="sketch-preview" />
                    <button
                      className="remove-image-btn"
                      onClick={handleRemoveSketch}
                      aria-label="Remove pose sketch"
                    >
                      &times;
                    </button>
                  </div>
                ) : (
                   <p className="disabled-message" style={{visibility: image ? 'hidden' : 'visible'}}>Upload a main photo to enable sketching.</p>
                )}
                <button
                  className="style-idea-btn"
                  onClick={handleOpenSketchModal}
                  disabled={!image}
                >
                  {poseSketch ? 'Edit Sketch' : 'Create Pose Sketch'}
                </button>
              </div>
            </div>
          </div>
          
          <div className={`control-group accordion ${openSections.filters ? 'open' : ''}`}>
            <div
              className="accordion-header"
              role="button"
              tabIndex={0}
              onClick={() => toggleSection('filters')}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleSection('filters')}
              aria-expanded={openSections.filters}
              aria-controls="filter-content"
            >
              <label>3. Apply a Filter (Optional)</label>
              <span className="accordion-icon" aria-hidden="true">+</span>
            </div>
            <div className="accordion-content" id="filter-content">
              <div className="filter-controls">
                <div className="filter-swatches-grid">
                  {filterPresets.map(preset => (
                    <button
                      key={preset.key}
                      className={`filter-swatch ${activeFilterPreset === preset.key ? 'active' : ''}`}
                      onClick={() => handlePresetFilterClick(preset)}
                      aria-label={`Apply ${preset.name} filter`}
                      aria-pressed={activeFilterPreset === preset.key}
                    >
                      <div className="swatch-preview">
                        {image ? (
                          <img
                            src={URL.createObjectURL(image.file)}
                            alt={`Preview of ${preset.name} filter`}
                            style={{ filter: getCssFilterStringFromValues(preset.values) }}
                          />
                        ) : (
                          <div className="swatch-placeholder" style={{ filter: getCssFilterStringFromValues(preset.values) }}>
                            <span>🍌</span>
                          </div>
                        )}
                      </div>
                      <span className="swatch-label">{preset.name}</span>
                    </button>
                  ))}
                </div>
                <div className="filter-sliders">
                    <div className="filter-sliders-header">
                        <h4>Fine-Tune</h4>
                        <button className="reset-btn" onClick={handleResetFilters}>Reset</button>
                    </div>
                    <div className="slider-container">
                      <label htmlFor="brightness">Brightness</label>
                      <input type="range" id="brightness" min="0" max="200" value={filters.brightness} onChange={(e) => handleFilterChange('brightness', e.target.value)} />
                      <span>{filters.brightness}%</span>
                    </div>
                    <div className="slider-container">
                      <label htmlFor="contrast">Contrast</label>
                      <input type="range" id="contrast" min="0" max="200" value={filters.contrast} onChange={(e) => handleFilterChange('contrast', e.target.value)} />
                      <span>{filters.contrast}%</span>
                    </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className={`control-group accordion ${openSections.birthdayFun ? 'open' : ''}`}>
            <div
              className="accordion-header"
              role="button"
              tabIndex={0}
              onClick={() => toggleSection('birthdayFun')}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleSection('birthdayFun')}
              aria-expanded={openSections.birthdayFun}
              aria-controls="birthday-fun-content"
            >
              <label>4. 🎂 Birthday Fun</label>
              <span className="accordion-icon" aria-hidden="true">+</span>
            </div>
            <div className="accordion-content" id="birthday-fun-content">
               <div className="style-ideas-grid">
                  <button className="style-idea-btn" onClick={handleAddBirthdayTheme}>
                    Add Birthday Theme
                  </button>
               </div>
            </div>
          </div>

          <div className={`control-group ${isClothingUploadDisabled ? 'disabled-section' : ''}`}>
            <label htmlFor="clothing-file-upload">5. Upload Clothing (Optional)</label>
             {isClothingUploadDisabled && <p className="disabled-message">Clear the prompt to upload an accessory.</p>}
            <div 
              className={`file-input-area ${clothingImage ? 'has-image' : ''} ${isClothingUploadDisabled ? 'disabled' : ''}`}
              onClick={() => !isClothingUploadDisabled && clothingFileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDrop={handleClothingDrop}
              role="button"
              tabIndex={isClothingUploadDisabled ? -1 : 0}
              aria-label="Clothing or accessory image upload area"
              aria-disabled={isClothingUploadDisabled}
            >
              {isUploading === 'clothing' && <div className="loading-overlay"><div className="loader small"></div></div>}
              <input
                id="clothing-file-upload"
                type="file"
                accept="image/*"
                onChange={handleClothingFileChange}
                ref={clothingFileInputRef}
                style={{ display: 'none' }}
                aria-hidden="true"
                disabled={isClothingUploadDisabled}
              />
              {clothingImage ? (
                <div className="image-preview-container">
                  <img src={URL.createObjectURL(clothingImage.file)} alt="Uploaded clothing or accessory" className="image-preview" />
                  <button 
                    className="remove-image-btn" 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveImage('clothing');
                    }}
                    aria-label="Remove clothing image"
                  >
                    &times;
                  </button>
                </div>
              ) : (
                <div className="file-input-placeholder">
                  <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="upload-icon"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
                  <p><strong>Click or drag &amp; drop</strong> an item</p>
                  <span className="file-input-or-divider">or</span>
                  <button
                    className="camera-btn"
                    onClick={(e) => { e.stopPropagation(); handleOpenCamera('clothing'); }}
                    disabled={isCameraLoading === 'clothing' || isClothingUploadDisabled || !hasCamera}
                    title={!hasCamera ? "No camera was detected on your device." : "Use your device's camera"}
                  >
                    {isCameraLoading === 'clothing' ? 'Starting...' : !hasCamera ? 'No Camera' : 'Use Camera'}
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className={`control-group accordion ${openSections.styleIdeas ? 'open' : ''}`}>
            <div
              className="accordion-header"
              role="button"
              tabIndex={0}
              onClick={() => toggleSection('styleIdeas')}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleSection('styleIdeas')}
              aria-expanded={openSections.styleIdeas}
              aria-controls="style-ideas-content"
            >
              <label>6. Style Ideas (Optional)</label>
              <span className="accordion-icon" aria-hidden="true">+</span>
            </div>
            <div className="accordion-content" id="style-ideas-content">
              {areStyleIdeasDisabled && <p className="disabled-message">Remove the uploaded item or clear the prompt to use Style Ideas.</p>}
              <div className="style-ideas-grid">
                <button className="style-idea-btn" onClick={handleHairstyleClick} disabled={areStyleIdeasDisabled}>💇‍♀️ Hairstyles</button>
                <button className="style-idea-btn" onClick={() => handleGenerateStyleIdeasClick('clothing')} disabled={areStyleIdeasDisabled}>👕 Clothing</button>
                <button className="style-idea-btn" onClick={() => handleGenerateStyleIdeasClick('hats')} disabled={areStyleIdeasDisabled}>🎩 Hats</button>
                <button className="style-idea-btn" onClick={() => handleGenerateStyleIdeasClick('scarves')} disabled={areStyleIdeasDisabled}>🧣 Scarves</button>
                <button className="style-idea-btn" onClick={() => handleGenerateStyleIdeasClick('glasses')} disabled={areStyleIdeasDisabled}>🕶️ Glasses</button>
                <button className="style-idea-btn" onClick={() => handleGenerateStyleIdeasClick('collars')} disabled={areStyleIdeasDisabled}>🐾 Collars</button>
                <button className="style-idea-btn" onClick={() => handleGenerateStyleIdeasClick('decorations')} disabled={areStyleIdeasDisabled}>🎀 Decorations</button>
              </div>
            </div>
          </div>

          <div className={`control-group accordion ${openSections.petAccessories ? 'open' : ''}`}>
            <div
              className="accordion-header"
              role="button"
              tabIndex={0}
              onClick={() => toggleSection('petAccessories')}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleSection('petAccessories')}
              aria-expanded={openSections.petAccessories}
              aria-controls="pet-accessories-content"
            >
              <label>7. Pet Accessories (Optional)</label>
              <span className="accordion-icon" aria-hidden="true">+</span>
            </div>
            <div className="accordion-content" id="pet-accessories-content">
              {arePetAccessoriesDisabled && <p className="disabled-message">Remove the uploaded item or clear other accessory prompts to use this section.</p>}
              <div className="style-ideas-grid">
                <button className="style-idea-btn" onClick={() => handleAccessoryClick('bow ties')} disabled={arePetAccessoriesDisabled}>👔 Bow Ties</button>
                <button className="style-idea-btn" onClick={() => handleAccessoryClick('hats')} disabled={arePetAccessoriesDisabled}>👒 Hats</button>
                <button className="style-idea-btn" onClick={() => handleAccessoryClick('necklaces')} disabled={arePetAccessoriesDisabled}>💎 Necklaces</button>
                <button className="style-idea-btn" onClick={() => handleAccessoryClick('wings')} disabled={arePetAccessoriesDisabled}>🦋 Wings</button>
              </div>
            </div>
          </div>

          <div className={`control-group accordion ${openSections.effects ? 'open' : ''}`}>
            <div
              className="accordion-header"
              role="button"
              tabIndex={0}
              onClick={() => toggleSection('effects')}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleSection('effects')}
              aria-expanded={openSections.effects}
              aria-controls="effects-content"
            >
              <label>8. Add an Effect (Optional)</label>
              <span className="accordion-icon" aria-hidden="true">+</span>
            </div>
            <div className="accordion-content" id="effects-content">
              <div className="style-ideas-grid">
                {effects.map(eff => (
                  <button
                    key={eff.key}
                    className={`style-idea-btn ${selectedEffect === eff.key ? 'active' : ''}`}
                    onClick={() => setSelectedEffect(eff.key)}
                    aria-pressed={selectedEffect === eff.key}
                  >
                    {eff.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className={`control-group accordion ${openSections.artStyles ? 'open' : ''}`}>
            <div
              className="accordion-header"
              role="button"
              tabIndex={0}
              onClick={() => toggleSection('artStyles')}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleSection('artStyles')}
              aria-expanded={openSections.artStyles}
              aria-controls="art-style-content"
            >
              <label>9. Choose an Art Style (Optional)</label>
              <span className="accordion-icon" aria-hidden="true">+</span>
            </div>
            <div className="accordion-content" id="art-style-content">
              <div className="style-selector-grid">
                {artStyles.map(style => (
                  <button 
                    key={style.name} 
                    className="style-selector-btn" 
                    onClick={() => handleStyleAppend(style)}
                  >
                    {style.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="control-group">
            <label htmlFor="prompt-input">10. Describe Your Edit</label>
            <div className="prompt-wrapper">
              <textarea
                id="prompt-input"
                value={prompt}
                onChange={(e) => {
                  setPrompt(e.target.value);
                  // Clear suggestions as soon as the user starts typing their own prompt
                  if (promptSuggestions.length > 0) {
                    setPromptSuggestions([]);
                  }
                }}
                placeholder="e.g., put this hat on my dog, add this bow to the cat's collar..."
                aria-label="Editing prompt"
                rows={3}
              />
              {prompt && (
                <button
                  className="clear-prompt-btn"
                  onClick={handleClearPrompt}
                  aria-label="Clear prompt text"
                >
                  &times;
                </button>
              )}
            </div>
            {promptSuggestions.length > 0 && (
                <div className="prompt-suggestions">
                    {promptSuggestions.map((suggestion, index) => (
                        <button 
                            key={index} 
                            className="suggestion-btn" 
                            onClick={() => {
                                setPrompt(suggestion);
                                setPromptSuggestions([]); // Clear suggestions after one is clicked
                            }}
                        >
                            {suggestion}
                        </button>
                    ))}
                </div>
            )}
          </div>

          <div className="control-group">
            <label htmlFor="variations-input">11. Number of Variations</label>
            <div className="variations-control">
              <input
                id="variations-input"
                type="range"
                min="1"
                max="4"
                value={numberOfVariations}
                onChange={(e) => setNumberOfVariations(Number(e.target.value))}
                aria-label="Number of variations to generate"
              />
              <span>{numberOfVariations}</span>
            </div>
          </div>

          <div className="generate-buttons-container">
            <button
              className="submit-btn"
              onClick={handleGenerateClick}
              disabled={!prompt || !image || loading || isVideoLoading}
              aria-busy={loading}
            >
              {loading ? 'Magicking...' : '✨ Generate Image'}
            </button>
            <button
              className="submit-btn video-btn"
              onClick={handleGenerateVideoClick}
              disabled={generatedImages.length === 0 || loading || isVideoLoading}
              aria-busy={isVideoLoading}
            >
              {isVideoLoading ? 'Filming...' : '🎬 Generate Video'}
            </button>
          </div>
        </section>

        <section className="display-panel" aria-live="polite">
          <div className="display-panel-top-bar">
            <h2>Results</h2>
            <button
              onClick={handleOpenGallery}
              className="gallery-btn"
              disabled={generatedImages.length === 0}
              aria-label={`Open gallery. ${generatedImages.length} images available.`}
            >
              🖼️ My Gallery ({generatedImages.length})
            </button>
          </div>
          <div className="display-panel-content">
            {isVideoLoading && (
                <div className="video-loading-overlay">
                    <div className="loader"></div>
                    <p className="video-loading-message">{videoLoadingMessage}</p>
                </div>
            )}
            {loading && !isVideoLoading && <div className="loader" aria-label="Loading"></div>}
            {error && <div className="error-message" role="alert">{error}</div>}
            
            {!loading && !isVideoLoading && !error && generatedVideo && (
              <video 
                src={generatedVideo} 
                className="generated-video"
                autoPlay 
                loop 
                muted 
                playsInline 
                controls
                aria-label="Generated pet video"
              />
            )}

            {!loading && !isVideoLoading && !error && !generatedVideo && generatedImages.length > 0 && (
              <div className="gallery-container">
                  <div className="selected-image-container">
                     {generatedImages.length > 1 && (
                        <>
                            <button className="carousel-nav-btn prev" onClick={() => handleCarouselNav('prev')} aria-label="Previous image">&lt;</button>
                            <button className="carousel-nav-btn next" onClick={() => handleCarouselNav('next')} aria-label="Next image">&gt;</button>
                        </>
                    )}
                    {generatedImages[currentImageIndex] && <img src={generatedImages[currentImageIndex]} alt="Main generated image based on user's prompt" className="selected-image" />}
                  </div>
                  <div className="thumbnail-gallery">
                    {generatedImages.map((imgSrc, index) => (
                      <img
                        key={index}
                        src={imgSrc}
                        alt={`Generated image variation ${index + 1}`}
                        className={`thumbnail-image ${index === currentImageIndex ? 'selected' : ''}`}
                        onClick={() => setCurrentImageIndex(index)}
                        tabIndex={0}
                        role="button"
                        aria-pressed={index === currentImageIndex}
                      />
                    ))}
                  </div>
                  {generatedImages[currentImageIndex] && (
                      <button onClick={handleDownloadImage} className="download-btn">
                        Download Selected Image
                      </button>
                  )}
              </div>
            )}
            {!loading && !isVideoLoading && !error && generatedImages.length === 0 && !generatedVideo &&(
              <div className="placeholder-text">
                <h2>Your masterpiece will appear here!</h2>
                <p>Just upload photos and tell me what to create.</p>
              </div>
            )}
          </div>
        </section>
      </main>
      
      {isCameraOpen && (
        <div className="camera-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="camera-title">
          <div className="camera-modal-content">
            <h2 id="camera-title" style={{display: 'none'}}>Camera View</h2>
            <div className="camera-video-container">
              {cameraError ? (
                <div className="error-message">{cameraError}</div>
              ) : (
                <video ref={videoRef} autoPlay playsInline muted aria-label="Live camera feed"></video>
              )}
              {isCapturing && (
                <div className="camera-capture-feedback">
                  <span>Capturing...</span>
                </div>
              )}
            </div>
            <div className="camera-controls">
              <button onClick={handleCapturePhoto} disabled={!!cameraError || isCapturing} aria-label="Capture photo">Capture</button>
              <button onClick={handleCloseCamera} disabled={isCapturing} aria-label="Close camera">Close</button>
            </div>
          </div>
        </div>
      )}

      {isStyleModalOpen && (
          <div className="style-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="style-modal-title">
              <div className="style-modal-content">
                <div className="style-modal-header">
                  <h2 id="style-modal-title" className="style-modal-title">
                      {styleModalStep === 'categories'
                          ? `Choose a type of ${styleCategory}`
                          : `Select a ${selectedStyleSubCategory}`
                      }
                  </h2>
                  {styleModalStep === 'images' && (
                    <button
                        className="refresh-style-btn"
                        onClick={() => handleSubCategorySelect(selectedStyleSubCategory!)}
                        disabled={isStyleLoading}
                        aria-label="Get new style suggestions"
                    >
                        Refresh 🔄
                    </button>
                  )}
                </div>
                {isStyleLoading && <div className="loader" aria-label="Loading styles"></div>}
                {styleError && <div className="error-message" role="alert">{styleError}</div>}

                {!isStyleLoading && !styleError && (
                    <>
                        {styleModalStep === 'categories' && (
                            <div className="style-categories-grid">
                                {styleSubCategories.length > 0 ? styleSubCategories.map((subCat, index) => (
                                    <button key={index} className="style-category-btn" onClick={() => handleSubCategorySelect(subCat)}>
                                        {subCat}
                                    </button>
                                )) : <p>No categories found.</p>}
                            </div>
                        )}

                        {styleModalStep === 'images' && (
                            <div className="style-results-grid">
                                {styleResults.length > 0 ? styleResults.map((imgSrc, index) => (
                                    <button
                                        key={index}
                                        className="style-result-item"
                                        onClick={() => handleGeneratedStyleSelect(imgSrc)}
                                        disabled={isSelectingStyle}
                                        aria-label={`Select style idea ${index + 1}`}
                                    >
                                        <img src={imgSrc} alt={`Generated style idea ${index + 1}`} className="style-result-image" />
                                        <div className="style-result-item-label">
                                            <span>{isSelectingStyle ? 'Applying...' : 'Use this Style'}</span>
                                        </div>
                                    </button>
                                )) : <p>No results found. Please try again!</p>}
                            </div>
                        )}
                    </>
                )}
              <div className={`style-modal-controls ${styleModalStep === 'images' ? 'space-between' : ''}`}>
                  {styleModalStep === 'images' && <button onClick={handleStyleModalBack} disabled={isStyleLoading || isSelectingStyle}>Back</button>}
                  <button onClick={handleCloseStyleModal} disabled={isSelectingStyle}>Close</button>
              </div>
              </div>
          </div>
      )}

      {croppingImage && (
        <div className="cropper-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="cropper-title">
            <div className="cropper-modal-content">
                <h2 id="cropper-title">Crop Your Image</h2>
                <div ref={cropContainerRef} className={`cropper-container ${isCroppingActive ? 'cropping-active' : ''}`}>
                    <div
                      className="cropper-image-wrapper"
                      onMouseDown={handleImagePanMouseDown}
                      style={{
                        transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
                        cursor: zoom > 1 ? (isPanning ? 'grabbing' : 'grab') : 'default'
                      }}
                    >
                      <img
                          ref={cropImageRef}
                          src={croppingImage.src}
                          alt="Photo ready for cropping"
                          onLoad={(e) => {
                              // Set initial crop box size
                              if (cropBoxRef.current && cropContainerRef.current) {
                                  const img = e.currentTarget;
                                  const container = cropContainerRef.current;
                                  const imgWidth = img.offsetWidth;
                                  const imgHeight = img.offsetHeight;
                                  const size = Math.min(imgWidth, imgHeight) * 0.8;
                                  cropBoxRef.current.style.width = `${size}px`;
                                  cropBoxRef.current.style.height = `${size}px`;
                                  // Center the crop box within the container, not the image element
                                  cropBoxRef.current.style.left = `${(container.offsetWidth - size) / 2}px`;
                                  cropBoxRef.current.style.top = `${(container.offsetHeight - size) / 2}px`;
                              }
                          }}
                      />
                    </div>
                    <div ref={cropBoxRef} className="crop-box" onMouseDown={(e) => handleCropMouseDown(e, 'move')}>
                        <div className="crop-grid"></div>
                        <div className="crop-handle ne" onMouseDown={(e) => handleCropMouseDown(e, 'ne')}></div>
                        <div className="crop-handle nw" onMouseDown={(e) => handleCropMouseDown(e, 'nw')}></div>
                        <div className="crop-handle se" onMouseDown={(e) => handleCropMouseDown(e, 'se')}></div>
                        <div className="crop-handle sw" onMouseDown={(e) => handleCropMouseDown(e, 'sw')}></div>
                        <div className="crop-handle n" onMouseDown={(e) => handleCropMouseDown(e, 'n')}></div>
                        <div className="crop-handle s" onMouseDown={(e) => handleCropMouseDown(e, 's')}></div>
                        <div className="crop-handle e" onMouseDown={(e) => handleCropMouseDown(e, 'e')}></div>
                        <div className="crop-handle w" onMouseDown={(e) => handleCropMouseDown(e, 'w')}></div>
                    </div>
                </div>
                 <div className="zoom-controls">
                    <span>-</span>
                    <input
                      type="range"
                      min="1"
                      max="3"
                      step="0.01"
                      value={zoom}
                      onChange={handleZoomChange}
                      className="zoom-slider"
                      aria-label="Zoom slider"
                    />
                    <span>+</span>
                </div>
                <div className="aspect-ratio-controls">
                  {aspectRatios.map(ratio => (
                    <button
                      key={ratio.key}
                      className={cropAspectRatio === ratio.key ? 'active' : ''}
                      onClick={() => handleAspectRatioChange(ratio.key)}
                      aria-pressed={cropAspectRatio === ratio.key}
                    >
                      {ratio.label}
                    </button>
                  ))}
                </div>
                <div className="cropper-controls">
                    <button onClick={handleConfirmCrop}>Confirm Crop</button>
                    <button onClick={handleCancelCrop}>Cancel</button>
                </div>
            </div>
        </div>
      )}
      
      {isSketchModalOpen && (
        <div className="sketch-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="sketch-title">
          <div className="sketch-modal-content">
            <h2 id="sketch-title">Draw your desired pose</h2>
            <div className="sketch-toolbar">
              <div className="sketch-guide-controls">
                <span>Guide:</span>
                <button 
                  className={sketchGuide === 'pet' ? 'active' : ''} 
                  onClick={() => setSketchGuide('pet')}
                  aria-pressed={sketchGuide === 'pet'}
                >Pet</button>
                <button 
                  className={sketchGuide === 'human' ? 'active' : ''} 
                  onClick={() => setSketchGuide('human')}
                  aria-pressed={sketchGuide === 'human'}
                >Human</button>
                <button 
                  className={sketchGuide === 'none' ? 'active' : ''} 
                  onClick={() => setSketchGuide('none')}
                  aria-pressed={sketchGuide === 'none'}
                >Hide</button>
              </div>
              <div className="sketch-actions">
                <button onClick={handleRandomPose}>Random Pose</button>
                <button onClick={handleClearCanvas}>Clear Canvas</button>
              </div>
            </div>
            <div className="sketch-canvas-container">
              {sketchGuide !== 'none' && (
                <img 
                  src={sketchGuide === 'pet' ? PET_GUIDE_SVG : HUMAN_GUIDE_SVG} 
                  className="sketch-guide-overlay" 
                  alt={`Overlay guide for a ${sketchGuide} pose`} 
                />
              )}
              <canvas
                ref={sketchCanvasRef}
                className={`sketch-canvas ${isRandomPoseActive ? 'drawing-disabled' : ''}`}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
                width="500"
                height="500"
              />
            </div>
            <div className="sketch-controls">
              <button onClick={handleConfirmSketch}>Confirm Sketch</button>
              <button onClick={handleCloseSketchModal}>Cancel</button>
            </div>
          </div>
        </div>
      )}
      
      {isGalleryOpen && (
        <div className="gallery-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="gallery-title">
          <div className="gallery-modal-content">
            <div className="gallery-modal-header">
              <h2 id="gallery-title">My Gallery</h2>
              <button onClick={handleCloseGallery} className="close-modal-btn" aria-label="Close gallery">&times;</button>
            </div>
            {generatedImages.length > 0 && selectedGalleryImageIndex !== null ? (
              <div className="gallery-body">
                <div className="gallery-preview-area">
                  <img 
                    src={generatedImages[selectedGalleryImageIndex]} 
                    alt={`Selected gallery image ${selectedGalleryImageIndex + 1}`} 
                    className="gallery-preview-image"
                  />
                  <div className="gallery-actions">
                    <button onClick={handleUseAsMainImage}>Use as Main Image</button>
                    <button onClick={handleDownloadGalleryImage}>Download</button>
                    <button onClick={handleDeleteImage} className="delete-btn">Delete</button>
                  </div>
                </div>
                <div className="gallery-thumbnail-grid">
                  {generatedImages.map((imgSrc, index) => (
                    <button 
                      key={index} 
                      className={`gallery-thumbnail ${index === selectedGalleryImageIndex ? 'selected' : ''}`}
                      onClick={() => setSelectedGalleryImageIndex(index)}
                      aria-label={`View image ${index + 1}`}
                      aria-pressed={index === selectedGalleryImageIndex}
                    >
                      <img src={imgSrc} alt={`Gallery thumbnail ${index + 1}`} />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="gallery-empty-state">
                <p>Your generated images will appear here once you create them!</p>
              </div>
            )}
          </div>
        </div>
      )}

      <canvas ref={canvasRef} style={{ display: 'none' }} aria-hidden="true"></canvas>
    </>
  );
};

export default App;
