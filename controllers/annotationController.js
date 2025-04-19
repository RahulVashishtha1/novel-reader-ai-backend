const Annotation = require('../models/Annotation');
const Novel = require('../models/Novel');

// Get all annotations for a novel
const getAnnotations = async (req, res) => {
  try {
    const { novelId } = req.params;
    
    // Check if novel exists and user has access
    const novel = await Novel.findById(novelId);
    if (!novel) {
      return res.status(404).json({ message: 'Novel not found' });
    }
    
    // Check if user is the owner or an admin
    if (novel.owner.toString() !== req.user.userId && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to access annotations for this novel' });
    }
    
    // Get annotations
    const annotations = await Annotation.find({
      novel: novelId,
      user: req.user.userId,
    }).sort({ page: 1, 'textSelection.startOffset': 1 });
    
    res.status(200).json({ annotations });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get annotations for a specific page
const getPageAnnotations = async (req, res) => {
  try {
    const { novelId, page } = req.params;
    const pageNum = parseInt(page);
    
    // Check if novel exists and user has access
    const novel = await Novel.findById(novelId);
    if (!novel) {
      return res.status(404).json({ message: 'Novel not found' });
    }
    
    // Check if user is the owner or an admin
    if (novel.owner.toString() !== req.user.userId && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to access annotations for this novel' });
    }
    
    // Get annotations for the page
    const annotations = await Annotation.find({
      novel: novelId,
      user: req.user.userId,
      page: pageNum,
    }).sort({ 'textSelection.startOffset': 1 });
    
    res.status(200).json({ annotations });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create a new annotation
const createAnnotation = async (req, res) => {
  try {
    const { novelId } = req.params;
    const { page, textSelection, color, note, category } = req.body;
    
    // Validate required fields
    if (!page || !textSelection || !textSelection.startOffset || !textSelection.endOffset || !textSelection.selectedText) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    
    // Check if novel exists and user has access
    const novel = await Novel.findById(novelId);
    if (!novel) {
      return res.status(404).json({ message: 'Novel not found' });
    }
    
    // Check if user is the owner
    if (novel.owner.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Not authorized to add annotations to this novel' });
    }
    
    // Create annotation
    const annotation = await Annotation.create({
      user: req.user.userId,
      novel: novelId,
      page,
      textSelection,
      color: color || '#ffff00', // Default yellow if not provided
      note,
      category: category || 'highlight',
    });
    
    res.status(201).json({ annotation });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update an annotation
const updateAnnotation = async (req, res) => {
  try {
    const { annotationId } = req.params;
    const { color, note, category } = req.body;
    
    // Find the annotation
    const annotation = await Annotation.findById(annotationId);
    if (!annotation) {
      return res.status(404).json({ message: 'Annotation not found' });
    }
    
    // Check if user is the owner
    if (annotation.user.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Not authorized to update this annotation' });
    }
    
    // Update fields
    if (color) annotation.color = color;
    if (note !== undefined) annotation.note = note;
    if (category) annotation.category = category;
    
    await annotation.save();
    
    res.status(200).json({ annotation });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete an annotation
const deleteAnnotation = async (req, res) => {
  try {
    const { annotationId } = req.params;
    
    // Find the annotation
    const annotation = await Annotation.findById(annotationId);
    if (!annotation) {
      return res.status(404).json({ message: 'Annotation not found' });
    }
    
    // Check if user is the owner
    if (annotation.user.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Not authorized to delete this annotation' });
    }
    
    // Delete the annotation
    await Annotation.findByIdAndDelete(annotationId);
    
    res.status(200).json({ message: 'Annotation deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getAnnotations,
  getPageAnnotations,
  createAnnotation,
  updateAnnotation,
  deleteAnnotation,
};
