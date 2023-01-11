I'm looking for a way to add relative urls to the json of the units in a generic way.

These urls should be relative to the json file they are loaded from. Doing this will enable support for loading these json files from other domains. And for those domains to provide their own images in the content.

We could provide a special "url" MST type that would turn an relative url into an absolute one using the `env` passed to the `fromSnapshot` method of `types.custom`. However this would be a one way operation.
When we enable authoring of content we would want there to be a way to upload images and then refer to them in the content. If the same MST model is used for authoring and runtime, then we need there to be a way to write out relative URLs too.

We could make a special URL object that is returned by the MST models using a custom type. It would still be serialized as a string, but when loaded it would be n MST object. This URL object would have the original relative string. If the URL object could figure out its URL base (the URL it is relative to), it would store that when it was loaded. (this is part might be tricky) When the document is saved again the document can provide its saving URL in its environment and then the URL can decide if it can be written out as relative or if it has to be absolute.

The base could be figured out in the afterAttach hook. At this point it can access the document environment which could provide the loading URL. This loading URL would be separate from the saving URL since the same document could be saved in various place like the "Save As..." menu option in most programs.

I think this approach would handle cases where a tile is copied from the content into another document in that case it would become absolute.

The only current case where URLs should be written out as relative is when exporting a document or tile to the clipboard which is how authoring is currently done. In those case `appConfig.getUnitBasePath` is currently used to modify the URLs. When an image is saved if it has a filename the the path written out is unitBasePath/images/filename.

It is up to each tile to have a "exportJson" method which is passed a transformImageUrl function as an argument.

The filename is currently stored by each of the tiles in their content models. And it is also passed into the ImageMap so the filename can be preserved when the image is copied from the content into a student document.

If we use these URL model object we can probably get rid of this filename approach. However the filename is shown the user so we might want to keep it for that.

To support the current clipboard style export we'll have to make an assumption about the base path. In particular when a author makes a new document and then exports it, we'll probably want to do something like current unitBasePath/images/filename. In these cases the URL object won't have a base path or even a relative path when the author first creates it. It will just have an absolute path which is the path to the object in firebase. It can also have a filename because the user uploaded it that way. But currently that filename is not part of the absolute URL it is stored separately by the tile content model so it can be restored when the document is loaded again. If we want the URL object to compute it relative path during export is going to need to know this filename. The easy way to do that is to have the content model set it on the URL object after loading.

A better approach would be to write out the filename in URL itself, but this would require a migration of all of the old user content. So it might be best to start with the no migration approach, but also allow the storage of the filename in the URL object. This way new tiles could use this approach and we can try to find time to schedule the migration in the future.

---

The current unit url prototype branch works with relative URLs because it makes the assumption that all relative URLs are relative to the 2 folders above the unit URL. We'll have to come up with a way to migrate the content in the future so the paths are relative to unit itself.

I would note though that some of the content shares images from other units.

A problem with this hack is when the relative URLs are stored in user content. This can happen when a image tile is copied. The system should upload this image to Firebase, and update the URL so it is no longer relative, but this process can fail.

Also if we add support for loading multiple documents from different places at the same time this would break down. And finally it requires a strict structuring of the content which means you can't just copy and rename a unit folder. You'd also have to update all of the links.

Now the question is: is it worth adding relative URL support now, or is it better to stick with the hack so we can finish up the separation of the content. I guess it depends on how bad the hack is. It seems like the big issue will be how many relative paths are in the teacher and student content. Using a script to look through the production content, there are many places where relative urls to images are used. Both the "curriculum/..." form and the "assets/curriculum/..." form. So whether we go with the hack or not we have to deal with these.

These "local asset" URLs are not stored in firebase. So they remain in the student and teacher content. If we keep this approach then we need these student and teacher documents to have a relative path too. In order to support multiple locations/domains of authored content, we are going to have to store this info with the student and teacher documents we can know where to find their URLs. We could do this changing them to absolute URL when the content is copied, but that would then throw them into the external URL bucket which means they will be stored in firebase. Because there are some documents which can be shared across units because they are associated with a user not an assignment. It would be possible that some images copied into these shared documents could come from multiple locations. So it doesn't seem correct to treat them as relative like the current approach. It does seem right to treat them as absolute. And then we have to deal with the question of whether we upload them to firebase. If we don't want to upload them, this could be based on their common domain instead of just being relative. But imagine an external group publishing content then when their students used their content this would result in lots of images being stored in firebase.

The most simple option would be to stop copying external images into Firebase and then we'd just convert curriculum images to absolute URLs when they are copied out of the curriculum. This would kind of be a regression, but I think this would be a better approach than the current copying. If people are going to use external external images in curriculum or if we allow students to add random images from the internet then we should just let them fail.

The most simple approach seems to be to keep all of these old images around so the old teacher and student documents can find them. And then make these student and teacher documents have a relative path at the root of this content. But now that we have a script that could do the migration we could change the URLs. But I don't know what to change them to.

If things are working properly I believe the images of newly opened documents to get uploaded to firebase. So this should mainly be legacy content. But maybe I'm wrong about this, and even in modern content the images will not be uploaded to firebase.

TODO: check what happens in modern content? Does it actually copy these images up or do I have wrong?

For that we need to make a script to find all of these references. Or we need to make the hack more robust, by handling the old style asset paths. And we'll also need to make sure to keep all of the old images available at the same locations so they can be found by old content. So really it would be best for code cleanliness if we can have a script find these things.

The updated-supports-images.ts file has scripts that work with both firebase and firestore written in typescript. We can start with one of these as a base to write some querying scripts to find the URLs in the teacher and student content.

The place where things break is in the image map. It identifies the URL as relative. So the non URL refactoring approach would be for the image map to use the unit url as the base. It currently has to remove a few segments from the unit url since the image urls are relative to the root of the codebase instead of the unit itself. Currently all units are at a path like curriculum/unit-folder/unit.json  So we can strip off 2 segments of the path and that will be the relative part of the URL.


